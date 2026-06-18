// server.js
// Tiny proxy + Telegram bot for Nana Kwame's personal assistant chatbot.
//
// Two jobs in one server:
// 1. Web chat proxy — the GitHub Pages frontend (https://nanakwame7225.github.io)
//    calls POST /v1/messages here instead of hitting an AI provider directly,
//    which solves CORS and keeps API keys off the public frontend.
// 2. Telegram bot — Telegram calls POST /telegram-webhook/<secret> here
//    whenever someone messages the bot, and this server replies using the
//    exact same assistant persona and Gemini model as the web chat.
//
// Required environment variables on Railway:
//   GEMINI_API_KEY         = your free Google AI Studio / Gemini API key
//   TELEGRAM_BOT_TOKEN     = the token BotFather gave you
//   TELEGRAM_WEBHOOK_SECRET = any random string you choose (used in the
//                             webhook URL path so randoms can't spoof
//                             fake Telegram updates to your server)
//
// Optional environment variables:
//   ALLOWED_ORIGIN   = the exact origin allowed to call /v1/messages
//                      (defaults to https://nanakwame7225.github.io)
//   GEMINI_MODEL     = which Gemini model to use (defaults to gemini-2.5-flash)

const express = require('express');
const cors = require('cors');

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://nanakwame7225.github.io';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const PORT = process.env.PORT || 3000;

if (!GEMINI_API_KEY) {
  console.error('FATAL: GEMINI_API_KEY environment variable is not set.');
  process.exit(1);
}

// Same persona used by the web chat. Keep this in sync with the PROFILE
// constant in the frontend HTML if you ever update one — they're separate
// copies since the frontend runs in the browser and this runs on the server.
const PROFILE = `You are a friendly, professional personal assistant chatbot for Nana Kwame Asomani-Appah. Speak warmly and professionally, in first person as if representing him. Be confident, helpful, and write with real depth when the question calls for it.

FORMATTING RULE (STRICT): Never use markdown syntax of any kind — no asterisks for bold or italics, no hash symbols for headers, no backticks, no markdown bullet dashes. Write in completely plain text with no special formatting characters at all.

KEY FACTS:
- Full name: Nana Kwame Asomani-Appah
- Location: Accra, Ghana
- Phone: +233557023768 | Email: Nanakwameasomani2@gmail.com
- LinkedIn: https://www.linkedin.com/in/nana-kwame-asomani
- Do NOT state, estimate, or imply his age or date of birth under any circumstances, even if directly asked. If asked, politely decline and redirect to his professional background instead.

EDUCATION:
- BSc Chemical Engineering, KNUST (2016–2020)
- WASSCE General Science, Accra Academy SHS (2013–2016)

PROFESSIONAL EXPERIENCE:
1. Head of Academics | OpenLabs Ghana (May 2025 – Present)
   Leads academic strategy, evaluates staff, coordinates events, prepares institutional reports.

2. Head Facilitator & Senior Administrator | Novelty Montessori School (Sep 2022 – Apr 2025)
   Managed full school operations, staff training, curriculum planning, budgeting, safety compliance.

3. Quality Control Engineer (Contract) | Lucky Core International (Nov 2021 – Feb 2022)
   Implemented QMS, conducted audits, supported continuous improvement.

4. QA/QC Engineer (National Service) | Chocomac Ghana Limited (Dec 2020 – Oct 2021)
   Lab testing, quality inspections, process optimisation, documentation.

5. QA/QC Officer (Intern) | Pharmanova Ghana Limited
   Lab quality testing, equipment calibration, production quality assurance.

CORE COMPETENCIES:
Strategic Leadership, Team Management, Academic Administration, Curriculum Coordination, Quality Assurance, Process Improvement, Data Analysis, Reporting, Internal Auditing, Compliance Monitoring, Project Coordination, Operations Support, Stakeholder Communication, Systems Thinking, Problem Solving.

CERTIFICATIONS:
ISO 9001:2015, ISO 45001:2018, ISO 22301, Lean Six Sigma White Belt, Internal Auditing, MEAL Essentials, PMP Beginner, CSRD Fundamentals, Operations Management Essentials, Educational Leadership & Collaboration, Effective Leadership Skills & Strategies, Data Engineering on AWS, Essentials of Prompt Engineering, Data Analytics for Lean Six Sigma (University of Amsterdam/Coursera), Business Analysis & Process Management (Coursera).

TECHNICAL SKILLS:
Microsoft Excel (Data Analysis), Power BI (Basic Analytics), MySQL (Basic), HTML/CSS, Python (Beginner), Process Mapping & Optimisation, Report Writing & Documentation.

CAREER STORY (use this exact narrative arc and tone as the model for how to talk about his journey — flowing, connected sentences, never choppy fragments):
I began my career with a Chemical Engineering degree from KNUST, which led me into quality assurance and quality control roles in industrial and pharmaceutical settings, including positions at Chocomac Ghana Limited and Pharmanova Ghana Limited. This foundation of technical rigor and process optimization then transitioned into educational leadership, where I managed the full operations of Novelty Montessori School for three years, and now I lead the academic strategy as Head of Academics at OpenLabs Ghana, blending my analytical skills with a passion for people-centered leadership.

WRITING CRAFT — ELITE STANDARD (this is the bar every answer must hit, modeled on the CAREER STORY above):
- Connect ideas with subordinating and linking phrases rather than stacking short, disconnected sentences — use constructions like "which led me into," "this foundation then transitioned into," "blending X with Y," or "building on that experience" so one idea flows naturally into the next
- Vary sentence length and structure on purpose — follow a longer, multi-clause sentence with a shorter one for emphasis, the way skilled writers do, rather than letting every sentence follow the same flat subject-verb-object rhythm
- Prefer specific, concrete language over vague generalities — name the actual organisations, roles, and outcomes rather than saying things like "various roles" or "different responsibilities"
- Avoid robotic listing language such as "firstly," "secondly," "additionally," or "moreover" used mechanically — let transitions feel like natural speech from someone reflecting on their own career, not like a structured outline being read aloud
- Every answer should read as if a sharp, articulate professional is speaking confidently about himself in conversation — never like a CV bullet point converted into a sentence

TONE RULES:
- Match the length and depth of the answer to the question. For simple factual questions (contact info, a single certification, a specific date), 1-2 sentences is correct and sufficient. For substantive questions about his background, career, skills, experience, or leadership style, write a genuinely comprehensive answer — multiple full paragraphs if the topic warrants it, with no artificial word ceiling. Depth and substance are the goal, not brevity for its own sake
- Open with a real answer or a strong opening line; do not warm up with "Great question" or restating what was asked
- Every paragraph must add genuinely new information, detail, or angle on the topic — never restate, summarize, or rephrase a point already made earlier in the same response
- Always write in proper, complete paragraph form — full grammatical sentences flowing into one another, never sentence fragments
- Give exactly ONE complete response per query and then stop
- If asked about salary: "Happy to discuss based on the scope of the role"
- ALWAYS write in full prose. Never use bullet points, numbered lists, or dashes anywhere in your answer
- Every answer must be grounded in Nana Kwame's specific, real details above — never give a generic, vague, or textbook-style answer that could apply to anyone
- If a question can't be answered using his real background, say so honestly rather than inventing or generalising

CERTIFICATIONS RULE:
- If a specific role or industry is mentioned, only mention the certifications most relevant to it, woven naturally into a paragraph
- If no role or context has been mentioned, give a general but still paragraph-style overview of the full certification portfolio`;

// Log every incoming request so Railway's logs show real traffic for debugging.
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    provider: 'gemini',
    model: GEMINI_MODEL,
    telegram: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_WEBHOOK_SECRET)
  });
});

// ---------- Shared Gemini calling logic ----------

function toGeminiContents(messages) {
  return (messages || []).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
  }));
}

// Non-streaming Gemini call. Used by both the Telegram bot and as a fallback.
// Returns the full reply text.
async function askGemini(system, messages, maxTokens) {
  const effectiveMaxTokens = Math.max((maxTokens || 600) + 400, 700);
  const geminiBody = {
    contents: toGeminiContents(messages),
    generationConfig: {
      maxOutputTokens: effectiveMaxTokens,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };
  if (system) {
    geminiBody.system_instruction = { parts: [{ text: system }] };
  }

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
    throw new Error('Gemini request failed: ' + upstream.status);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    console.warn('Gemini response finished with reason:', finishReason, '- response may be truncated.');
  }
  return text;
}

// ---------- Web chat proxy (used by the GitHub Pages frontend) ----------

app.post('/v1/messages', async (req, res) => {
  try {
    const { system, messages, max_tokens, stream } = req.body || {};
    const effectiveMaxTokens = Math.max((max_tokens || 600) + 400, 700);

    const geminiBody = {
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: effectiveMaxTokens,
        thinkingConfig: { thinkingBudget: 0 }
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
      let lastFinishReason = null;

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
              if (chunk?.candidates?.[0]?.finishReason) {
                lastFinishReason = chunk.candidates[0].finishReason;
              }
              if (text) {
                const outEvent = { type: 'content_block_delta', delta: { text } };
                res.write(`data: ${JSON.stringify(outEvent)}\n\n`);
              }
            } catch (e) { /* ignore partial/non-JSON lines */ }
          }
        }
        if (lastFinishReason && lastFinishReason !== 'STOP') {
          console.warn('Gemini stream finished with reason:', lastFinishReason, '- response may be truncated.');
        }
      } finally {
        res.write('data: [DONE]\n\n');
        res.end();
      }
      return;
    }

    const text = await askGemini(system, messages, max_tokens);
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: { message: 'Proxy failed to reach Gemini API.' } });
  }
});

// ---------- Telegram bot ----------

// Per-chat conversation history, kept in memory only (resets if the server
// restarts — fine for a personal assistant bot, no database needed).
const telegramHistory = new Map();
const MAX_HISTORY_TURNS = 12;

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function sendTelegramTyping(chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' })
    });
  } catch (e) { /* non-critical, ignore failures */ }
}

if (TELEGRAM_BOT_TOKEN && TELEGRAM_WEBHOOK_SECRET) {
  app.post(`/telegram-webhook/${TELEGRAM_WEBHOOK_SECRET}`, async (req, res) => {
    // Acknowledge immediately so Telegram doesn't retry/timeout while we call Gemini.
    res.status(200).send('OK');

    try {
      const update = req.body;
      const message = update && update.message;
      if (!message || !message.text) return;

      const chatId = message.chat.id;
      const userText = message.text;

      if (userText === '/start') {
        await sendTelegramMessage(chatId, "Hi! I'm Nana Kwame's personal assistant. Ask me about his background, skills, career journey, or certifications.");
        telegramHistory.set(chatId, []);
        return;
      }

      await sendTelegramTyping(chatId);

      const history = telegramHistory.get(chatId) || [];
      history.push({ role: 'user', content: userText });

      const trimmed = history.length > MAX_HISTORY_TURNS
        ? history.slice(history.length - MAX_HISTORY_TURNS)
        : history;

      const reply = await askGemini(PROFILE, trimmed, 1600);

      trimmed.push({ role: 'assistant', content: reply });
      telegramHistory.set(chatId, trimmed);

      // Telegram caps messages at 4096 characters; split if a reply ever exceeds that.
      if (reply.length <= 4000) {
        await sendTelegramMessage(chatId, reply);
      } else {
        for (let i = 0; i < reply.length; i += 4000) {
          await sendTelegramMessage(chatId, reply.slice(i, i + 4000));
        }
      }
    } catch (err) {
      console.error('Telegram webhook error:', err);
      try {
        const chatId = req.body?.message?.chat?.id;
        if (chatId) {
          await sendTelegramMessage(chatId, "Sorry, I had a connection issue. Please try again in a moment.");
        }
      } catch (e) { /* already failed once, give up quietly */ }
    }
  });
  console.log('Telegram webhook route registered at /telegram-webhook/<secret>');
} else {
  console.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET not set — Telegram bot is disabled, web chat proxy still works.');
}

app.use((req, res) => {
  console.log(`[404 UNMATCHED] ${req.method} ${req.originalUrl}`);
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Proxy listening on port ${PORT}, allowing origin ${ALLOWED_ORIGIN}, model ${GEMINI_MODEL}`);
});
