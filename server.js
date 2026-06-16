// server.js
// Tiny proxy so the GitHub Pages frontend (https://nanakwame7225.github.io)
// can call Claude without hitting CORS, and without exposing the API key in the browser.
//
// Required environment variable on Railway:
//   ANTHROPIC_API_KEY   = your real Anthropic API key (sk-ant-...)
//
// Optional environment variable:
//   ALLOWED_ORIGIN       = the exact origin allowed to call this proxy
//                           (defaults to https://nanakwame7225.github.io)

const express = require('express');
const cors = require('cors');

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://nanakwame7225.github.io';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY environment variable is not set.');
  process.exit(1);
}

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/v1/messages', async (req, res) => {
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    // If the client asked for a stream, pipe the SSE response straight through.
    if (req.body && req.body.stream) {
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        res.end();
      }
      return;
    }

    // Non-streaming: just forward the JSON body and status.
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: { message: 'Proxy failed to reach Anthropic API.' } });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy listening on port ${PORT}, allowing origin ${ALLOWED_ORIGIN}`);
});
