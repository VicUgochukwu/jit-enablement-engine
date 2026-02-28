# Deploy to Railway

This guide gets the JIT Enablement Engine running on Railway with a permanent public URL. Once deployed, your CRM webhooks will reach the engine 24/7 — no terminal sessions, no tunnels, no restarts.

**Time:** ~10 minutes
**Cost:** Railway's free tier includes 500 hours/month — enough for the webhook server running full-time.

---

## Prerequisites

Before you start, you need:

- [ ] A GitHub account with the `jit-enablement-engine` repo pushed
- [ ] A Slack bot token (`xoxb-...`) or Telegram bot token
- [ ] (Optional) An Anthropic API key — without it, the engine uses template-based formatting from your KB content

---

## Step 1: Push Your Repo to GitHub

If you haven't already:

```bash
cd jit-enablement-engine
git init
git add -A
git commit -m "Initial commit"
gh repo create jit-enablement-engine --private --push
```

> **Important:** The `.gitignore` file excludes `.env` and `data/` automatically. Your API keys and KB content never touch GitHub.

<!-- Screenshot: GitHub repo page showing the pushed repo -->

---

## Step 2: Create a Railway Project

1. Go to [railway.com](https://railway.com) and sign in (or create an account)
2. Click **New Project** in the dashboard
3. Select **Deploy from GitHub repo**
4. If prompted, authorize Railway to access your GitHub account
5. Search for `jit-enablement-engine` and select it
6. Click **Add Variables** (don't deploy yet — we need to set env vars first)

<!-- Screenshot: Railway "New Project" screen with "Deploy from GitHub repo" highlighted -->

<!-- Screenshot: Railway repo search showing jit-enablement-engine selected -->

---

## Step 3: Set Environment Variables

In the **Variables** tab of your new service:

Click **New Variable** and add each of these:

| Variable | Value | Required? |
|----------|-------|-----------|
| `CHANNEL` | `slack` or `telegram` | Yes |
| `SLACK_BOT_TOKEN` | `xoxb-your-token` | Yes (if Slack) |
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather | Yes (if Telegram) |
| `PMM_SLACK_ID` | Your Slack user ID | Recommended (for notifications) |
| `PMM_TELEGRAM_CHAT_ID` | Your Telegram chat ID | Recommended (for notifications) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | No — adds AI prose |
| `DATA_DIR` | `/app/data` | Yes |

> **Tip:** You can also click **RAW Editor** and paste all variables at once in `KEY=VALUE` format.

> **Note:** You do NOT need to set `PORT` — Railway injects it automatically, and the engine reads it.

<!-- Screenshot: Railway Variables tab with the env vars filled in -->

---

## Step 4: Add a Persistent Volume

Your knowledge base, feedback log, and rep directory live in `data/`. Railway's filesystem is wiped on every deploy, so you need a persistent volume.

1. Open the Command Palette — press `⌘K` (Mac) or `Ctrl+K` (Windows)
2. Type **"Volume"** and select **Create Volume**
3. Attach it to your `jit-enablement-engine` service
4. Set the mount path to: `/app/data`
5. Confirm

This ensures your KB content survives deploys. Everything in `/app/data` persists permanently.

<!-- Screenshot: Railway volume creation dialog with mount path /app/data -->

---

## Step 5: Generate a Public URL

1. Click on your service in the project canvas
2. Go to **Settings** → **Networking** → **Public Networking**
3. Click **Generate Domain**
4. Railway gives you a URL like: `jit-enablement-engine-production-abc1.up.railway.app`

This URL has HTTPS enabled automatically. No certificates to configure.

<!-- Screenshot: Railway Settings → Networking showing the generated domain -->

---

## Step 6: Deploy

If Railway hasn't auto-deployed yet:

1. Go to the **Deployments** tab
2. Click **Deploy** (or push a new commit to trigger auto-deploy)
3. Wait for the build to complete (~1–2 minutes)
4. Check the deploy logs — you should see:

```
JIT Sales Enablement Engine
─────────────────────────────────────────
  Webhook server running on port [PORT]
  Channel: slack

  Routes:
    POST /webhook/crm          → CRM deal stage changes
    POST /webhook/feedback      → Slack interactions
    POST /webhook/telegram      → Telegram bot updates
    POST /webhook/call-intel    → Call intel submissions
    GET  /health               → Health check

  Ready to receive webhooks.
```

Verify it's running:

```bash
curl https://your-app.up.railway.app/health
```

You should get: `{"status":"ok","service":"jit-enablement-engine","channel":"slack","port":...}`

<!-- Screenshot: Railway deploy logs showing successful startup -->

---

## Step 7: Point Your CRM Webhook

Now connect your CRM to the engine. The webhook URL is:

```
https://your-app.up.railway.app/webhook/crm
```

### HubSpot
1. Go to **Settings → Integrations → Private Apps** (or use Workflows)
2. Create a workflow triggered on **Deal Stage Change**
3. Add an action: **Send Webhook**
4. URL: `https://your-app.up.railway.app/webhook/crm`
5. Method: POST, Content-Type: application/json

### Salesforce
1. Go to **Setup → Process Builder** (or Flow)
2. Create a flow triggered on **Opportunity Stage Change**
3. Add an HTTP Callout action
4. URL: `https://your-app.up.railway.app/webhook/crm`

### Pipedrive
1. Go to **Settings → Webhooks**
2. Create a webhook for **Deal Updated** events
3. URL: `https://your-app.up.railway.app/webhook/crm`

### Other CRMs
Any CRM that can POST a JSON body with `deal_name`, `deal_stage`, and `rep_email` will work:

```json
{
  "deal_name": "Acme Corp Enterprise",
  "deal_stage": "Proposal Sent",
  "company_name": "Acme Corp",
  "industry": "Financial Services",
  "competitor": "Gong",
  "deal_size": 125000,
  "rep_email": "sarah@team.com"
}
```

---

## Step 8: Set Up Feedback (Telegram)

If you're using Telegram, register the webhook so button clicks flow back to the engine:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.up.railway.app/webhook/telegram"
```

You should get: `{"ok":true,"result":true,"description":"Webhook was set"}`

### For Slack
Configure your Slack app's **Interactivity & Shortcuts** URL to:

```
https://your-app.up.railway.app/webhook/feedback
```

And set the **Event Subscriptions** Request URL to the same endpoint.

---

## Done

The engine is now running 24/7. When a deal moves stage in your CRM:

1. CRM sends a webhook → Railway receives it
2. Engine matches the best content from your KB
3. Rep gets a Slack DM or Telegram message with the enablement package
4. Rep taps Helpful/Not Helpful → feedback is logged
5. You ask "How is my content performing?" in Co-work → see real field data

Your KB is managed locally via Claude Code / Co-work. The Railway deployment handles the automated delivery and feedback loop.

---

## Step 9: Enable KB Sync (Automatic)

Your knowledge base lives in two places:

- **Locally** (via Claude Code / Co-work) — where you manage it through conversation
- **On Railway** (persistent volume) — where the webhook server reads it

The engine includes **automatic sync** — every time you add a case study, update competitor positioning, or register a rep locally, the change pushes to Railway instantly. No manual copying needed.

### Set Up Sync

1. **Generate a shared secret** — any random string works:

```bash
# Quick way to generate a random secret
openssl rand -hex 32
# Example output: a1b2c3d4e5f6...
```

2. **Add the secret to Railway** — go to your Railway service's Variables tab and add:

| Variable | Value |
|----------|-------|
| `SYNC_SECRET` | Your generated secret |

3. **Add sync config to your local `.env`** — in your local `jit-enablement-engine/.env`:

```
SYNC_URL=https://your-app.up.railway.app
SYNC_SECRET=your-generated-secret
```

> **Important:** Use the same secret in both places. The MCP server sends it as a Bearer token; the webhook server validates it.

4. **Re-register the MCP server** so it picks up the new env vars:

```bash
claude mcp remove jit-enablement
claude mcp add jit-enablement \
  -e DATA_DIR="$PWD/data" \
  -e SYNC_URL="https://your-app.up.railway.app" \
  -e SYNC_SECRET="your-generated-secret" \
  -- node "$PWD/dist/mcp/index.js"
```

5. **Test it** — in Claude Code, say: "Add a test case study for SyncTest Corp in Technology"

You should see `[JIT] Sync push OK: /api/kb` in the MCP server logs. Your Railway deployment now has the updated KB.

### How It Works

```
Claude Code / Co-work
  └─ "Add case study for Acme Corp..."
      └─ MCP tool: add_case_study
          └─ writeKB() → local data/knowledge-base.json
              └─ pushSync() → PUT https://railway-app/api/kb
                               (Bearer token auth)
                  └─ Railway server writes to /app/data/knowledge-base.json
```

- **One-way push**: Local → Railway (the MCP server is the single source of truth)
- **Fire-and-forget**: If Railway is down, the local write still succeeds. Sync errors are logged but never block your work
- **Automatic**: Every `writeKB()` and `writeRepDirectory()` triggers a push — no manual steps

### Manual Sync (Alternative)

If you don't want automatic sync, you can push manually with curl:

```bash
curl -X PUT "https://your-app.up.railway.app/api/kb" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret" \
  -d @data/knowledge-base.json
```

```bash
curl -X PUT "https://your-app.up.railway.app/api/rep-directory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret" \
  -d @data/rep-directory.json
```

---

## Troubleshooting

### Server crashes on startup
Check the deploy logs. Common causes:
- Missing required env var (`SLACK_BOT_TOKEN` when `CHANNEL=slack`)
- Invalid token format

### Webhooks return 404
Make sure your CRM is POSTing to `/webhook/crm` (not just `/webhook` or `/`).

### Feedback buttons don't work
- **Telegram:** Make sure you ran the `setWebhook` command in Step 8
- **Slack:** Make sure Interactivity is enabled and the URL points to `/webhook/feedback`

### KB is empty after deploy
You need to create a persistent volume (Step 4) and set `DATA_DIR=/app/data`. Without the volume, the empty default KB is recreated on every deploy.

### Deploys wipe my KB
Your volume mount path must match `DATA_DIR`. Both should be `/app/data`.
