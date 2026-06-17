NK Personal Assistant Proxy
Tiny Express server that sits between the GitHub Pages chatbot
(https://nanakwame7225.github.io/nana-kwame-personal_assistant/) and an AI
model provider. It now uses Google's Gemini API (free tier) as the
backing model instead of the Anthropic API, while keeping the exact same
`/v1/messages` request/response shape the frontend already calls. This
means the HTML/JS frontend never needed to change — only this proxy did.
Why this exists
CORS — calling AI provider APIs directly from a static GitHub Pages
site gets blocked by the browser, since most providers don't allow
arbitrary browser origins. This proxy calls the provider from a server
instead, and returns the response with the right CORS headers.
API key safety — the API key lives only in this server's environment
variables, never in frontend HTML/JS where anyone could view-source and
steal it.
Provider independence — the frontend speaks one stable "API shape"
to this proxy. If you ever want to switch providers again (e.g. to Groq,
OpenRouter, or back to Anthropic once billing is sorted), you only need
to edit this one file — the frontend keeps working unchanged.
Deploy to Railway
Push this folder (`server.js`, `package.json`, `README.md`) to its own
GitHub repo, e.g. `nk-personal-assistant-proxy` (or update your existing
one if you already deployed it once).
In Railway, create/open the project connected to that repo.
Under the service's Variables tab, set:
`GEMINI_API_KEY` = your free Google AI Studio API key
`ALLOWED_ORIGIN` = `https://nanakwame7225.github.io` (already the
default; only needed if your frontend's domain ever changes)
`GEMINI_MODEL` = optional, defaults to `gemini-2.5-flash`
Remove the old `ANTHROPIC_API_KEY` variable if it's still set — it's
no longer used and there's no reason to keep it around.
Railway redeploys automatically. Test with:
`curl https://YOUR-RAILWAY-URL/health` → should return
`{"ok":true,"provider":"gemini","model":"gemini-2.5-flash"}`
Frontend
No changes needed. The frontend's `PROXY_URL` constant should already point
at your Railway URL + `/v1/messages` from the previous setup. As long as
that's correct, the chatbot will now run on Gemini under the hood.
Free tier notes
Google's Gemini free tier has daily and per-minute rate limits (commonly
~15 requests/minute and ~1,500 requests/day on Flash models, though Google
can adjust these). If you ever hit a rate limit, the chatbot will show a
connection error until the limit resets — this is expected behavior on a
free tier, not a bug.
