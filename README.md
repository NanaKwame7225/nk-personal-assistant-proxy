# NK Personal Assistant Proxy

Tiny Express server that sits between the GitHub Pages chatbot
(https://nanakwame7225.github.io/nana-kwame-personal_assistant/) and the
Anthropic API. It exists purely to solve two problems that a static
GitHub Pages site cannot solve on its own:

1. **CORS** — `api.anthropic.com` does not allow direct browser calls from
   arbitrary origins like GitHub Pages. This proxy calls Anthropic from a
   server instead, and returns the response with the right CORS headers
   so the browser accepts it.
2. **API key safety** — the Anthropic API key lives only in this server's
   environment variables, never in the frontend HTML/JS where anyone could
   view-source and steal it.

## Deploy to Railway

1. Push this folder to its own GitHub repo (e.g. `nk-personal-assistant-proxy`),
   or deploy directly from this folder using the Railway CLI.
2. In Railway, create a new project from that repo.
3. Under the service's **Variables** tab, add:
   - `ANTHROPIC_API_KEY` = your real Anthropic API key (starts with `sk-ant-`)
   - `ALLOWED_ORIGIN` = `https://nanakwame7225.github.io` (already the default,
     only needed if you ever change the frontend's domain)
4. Deploy. Railway will run `npm install` then `npm start` automatically.
5. Once live, Railway gives you a public URL like:
   `https://nk-personal-assistant-proxy-production.up.railway.app`
6. Test it: `curl https://YOUR-RAILWAY-URL/health` should return `{"ok":true}`.

## Point the frontend at it

In the chatbot's HTML file, change every

```js
fetch('https://api.anthropic.com/v1/messages', ...)
```

to

```js
fetch('https://YOUR-RAILWAY-URL/v1/messages', ...)
```

Do **not** send the `x-api-key` header from the frontend anymore — the proxy
adds it server-side. Everything else (model, messages, stream, max_tokens)
stays exactly the same, since this proxy is a transparent pass-through.
