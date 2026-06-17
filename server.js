// server.js
// Tiny proxy so the GitHub Pages frontend (https://nanakwame7225.github.io)
// can call an AI model without hitting CORS, and without exposing any API key in the browser.
//
// This proxy exposes the SAME endpoint shape the frontend already calls
// (POST /v1/messages with { model, max_tokens, system, messages, stream }),
// but internally translates the request to Google's Gemini API and translates
// Gemini's response back into the Anthropic-style shape the frontend expects.
// This means the frontend code never needs to change providers again --
// only this file needs to change if you ever swap providers.
//
// Required environment variable on Railway:
//   GEMINI_API_KEY   = your free Google AI Studio / Gemini API key
//
// Optional environment variables:
//   ALLOWED_ORIGIN   = the exact origin allowed to call this proxy
//                      (defaults to https://nanakwame7225.github.io)
//   GEMINI_MODEL     = which Gemini model to use (defaults to gemini-2.5-flash)

const express = require('express');
const cors = require('cors');

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://nanakwame7225.github.io';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PORT = process.env.PORT || 3000;

if (!GEMINI_API_KEY) {
  console.error('FATAL: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, provider: 'gemini', model: GEMINI_MODEL });
});

// Convert Anthropic-style { messages: [{role, content}] } into Gemini's
// { contents: [{role, parts: [{text}]}] } shape. Anthropic uses "assistant",
// Gemini uses "model" for the bot's turns; "user" stays the same.
function toGeminiContents(messages) {
  return (messages || []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
  }));
}

app.post('/v1/messages', async (req, res) => {
  try {
    const { system, messages, max_tokens, stream } = req.body || {};

    const geminiBody = {
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens || 600
      }
    };
    if (system) {
      geminiBody.system_instruction = { parts: [{ text: system }] };
    }

    if (stream) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify(geminiBody)
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error('Gemini stream error:', upstream.status, errText);
        res.status(upstream.status);
        res.setHeader('Content-Type', 'application/json');
        return res.end(errText);
      }

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              const chunk = JSON.parse(payload);
              const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                // Re-emit in the Anthropic content_block_delta shape the frontend already parses.
                const outEvent = {
                  type: 'content_block_delta',
                  delta: { text }
                };
                res.write(`data: ${JSON.stringify(outEvent)}\n\n`);
              }
            } catch (e) { /* ignore partial/non-JSON lines */ }
          }
        }
      } finally {
        res.write('data: [DONE]\n\n');
        res.end();
      }
      return;
    }

    // Non-streaming path
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(geminiBody)
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Gemini error:', upstream.status, data);
      return res.status(upstream.status).json(data);
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    // Re-shape into the Anthropic-style { content: [{type, text}] } the frontend expects.
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: { message: 'Proxy failed to reach Gemini API.' } });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy listening on port ${PORT}, allowing origin ${ALLOWED_ORIGIN}, model ${GEMINI_MODEL}`);
});
