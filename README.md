NK Personal Assistant Proxy + Telegram Bot
This Express server does two jobs:
Web chat proxy — lets the GitHub Pages chatbot
(https://nanakwame7225.github.io/nana-kwame-personal_assistant/) call an
AI model without CORS issues or exposing any API key in the browser.
Telegram bot — runs the same assistant persona as a live bot on
Telegram, replying to anyone who messages it.
Both share the same Gemini-calling logic and the same free Gemini API key.
Environment variables (set these in Railway → Variables)
Variable	Required	Description
`GEMINI_API_KEY`	Yes	Your free Google AI Studio API key
`TELEGRAM_BOT_TOKEN`	For Telegram	The token BotFather gave you when you ran `/newbot`
`TELEGRAM_WEBHOOK_SECRET`	For Telegram	Any random string you make up yourself (e.g. a long random word). Used as a secret path in the webhook URL so random people on the internet can't send fake messages to your bot.
`ALLOWED_ORIGIN`	No	Defaults to `https://nanakwame7225.github.io`
`GEMINI_MODEL`	No	Defaults to `gemini-2.5-flash`
If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET` are missing, the server
still runs fine — it just skips registering the Telegram route and the web
chat proxy keeps working as before.
Deploying an update
Push the updated `server.js` to your `nk-personal-assistant-proxy` GitHub
repo (overwrite the old file).
Add the two new Telegram variables in Railway.
Railway auto-redeploys.
Connecting Telegram to this server (one-time setup)
Once the server is deployed with both Telegram variables set, you need to
tell Telegram where to send updates. Run this once, replacing the two
placeholders with your real bot token and your real Railway URL:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_RAILWAY_URL>/telegram-webhook/<YOUR_WEBHOOK_SECRET>
```
Just paste that full URL (with your real values substituted in) into any
browser address bar and press enter. Telegram will respond with:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```
That confirms it. From that point on, anyone who messages your bot on
Telegram gets a live reply from the same assistant persona as the website.
To verify it's registered correctly at any time:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```
This should show your Railway URL under `"url"`.
Notes
Conversation history per Telegram chat is kept in memory only (resets if
the server restarts). That's intentional — this is a personal assistant
bot, not something that needs a database.
Telegram messages are capped at 4096 characters; long replies are
automatically split into multiple messages.
The bot responds to `/start` with a short welcome message and clears that
chat's history, the same way reopening the website would.
