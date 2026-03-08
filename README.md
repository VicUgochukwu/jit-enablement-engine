<h1 align="center">JIT Sales Enablement Engine</h1>

<p align="center">
  <strong>Push-based sales enablement triggered by CRM deal stage changes.</strong><br/>
  MCP server with 16 tools + webhook server. No n8n, no GitHub storage, no external workflow tools.<br/>
  Reps get the right content at the right time — automatically.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/typescript-5.7-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MCP-16_tools-purple" alt="MCP Tools" />
  <img src="https://img.shields.io/badge/tests-215_passing-green" alt="Tests" />
  <img src="https://img.shields.io/badge/CRMs-6_supported-orange" alt="CRMs" />
  <img src="https://img.shields.io/badge/channels-slack_+_telegram-blue" alt="Channels" />
</p>

---

## The Problem

Sales enablement is reactive. Reps dig through Confluence, Notion, or Slack to find the right case study or objection response — if they find it at all. Content exists, but it doesn't reach the rep at the moment they need it.

## The Solution

This engine **pushes** personalized enablement content to reps when CRM deals change stages. A deal moves to "Proposal Sent"? The rep gets a Slack/Telegram DM with relevant case studies, competitor positioning, and objection responses — assembled from your knowledge base and tailored to the deal's industry and competitive context.

```
CRM deal stage changes → Webhook fires → Engine matches KB content → Rep gets DM
```

No manual lookup. No stale decks. Content finds the rep.

---

## How It Works

```
  ┌─────────────────────────┐
  │      Claude Code        │
  │  PMM manages KB + reps  │
  │   via natural language   │
  └───────────┬─────────────┘
              │ stdio
  ┌───────────▼─────────────┐
  │      MCP Server         │
  │   16 tools:             │
  │   KB mgmt (12) +        │
  │   Rep directory (3) +   │
  │   Enablement preview (1)│
  └───────────┬─────────────┘
              │ filesystem
  ┌───────────▼─────────────┐        ┌──────────────┐
  │  Express Webhook Server │◄───────│  Railway /   │
  │  POST /webhook/crm      │  sync  │  Render      │
  │  POST /webhook/feedback  │        └──────────────┘
  │  POST /webhook/telegram  │
  │  POST /webhook/call-intel│
  └───────────┬─────────────┘
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
Claude API  Slack API  Telegram API
(optional)
```

---

## Pipeline

When a CRM webhook fires, the engine runs a 7-step async pipeline:

| Step | What Happens |
|------|-------------|
| **1. Parse** | Auto-detect CRM type (HubSpot, Salesforce, Attio, Pipedrive, Close, generic) from payload shape |
| **2. Enrich** | Apply defaults — industry, competitor, company name from deal fields |
| **3. Resolve Rep** | Find the right messaging account: CRM field → Rep directory → Slack API lookup → email fallback |
| **4. Gate** | Block delivery if KB is unconfigured (prevents hallucination — no case studies = no send) |
| **5. Generate** | Claude API writes personalized content from KB entries, OR template-based matching if no API key |
| **6. Format** | Block Kit (Slack) or HTML (Telegram) with feedback buttons |
| **7. Send + Log** | Deliver to rep DM, record delivery with surfaced content for tracking |

---

## Phased Setup

### Phase 1: Foundation (Zero Credentials)
Build your knowledge base using Claude Code. No API keys needed.

```
"Add a case study for Acme Corp in the healthcare vertical..."
"Set methodology to MEDDIC with stage-specific guidance..."
"Add rep Sarah Chen — Slack ID U0123ABC, email sarah@team.com"
"Preview what a rep would get for a fintech deal in negotiation stage"
```

### Phase 2: Equip (Messaging Token Required)
Connect to your CRM and messaging platform.

```bash
# Add to .env
SLACK_BOT_TOKEN=xoxb-your-token    # or TELEGRAM_BOT_TOKEN
ANTHROPIC_API_KEY=sk-ant-...        # optional — template mode works without it

npm run start:server
# Point CRM webhook to http://your-server:3456/webhook/crm
```

### Phase 3: Listen
Reps react to content (helpful / not helpful), reply with field intel. Feedback is tracked automatically.

### Phase 4: Adapt
Use feedback to improve your KB:
```
"How is my content performing?"
"What field signals have reps sent?"
"Which deals that got enablement ended up closing?"
```

---

## MCP Tools (16)

### Knowledge Base Management (12)

| Tool | Description |
|------|-------------|
| `add_case_study` | Add customer story with industry, segment, metrics, and relevant deal stages |
| `add_competitor` | Add competitive positioning with differentiators and evidence |
| `add_objection` | Add objection/response pair mapped to competitors and stages |
| `set_methodology` | Configure sales methodology (MEDDIC, BANT, Challenger, etc.) |
| `list_entries` | List all KB content by type with entry counts |
| `search_entries` | Filter by industry, competitor, or deal stage |
| `remove_entry` | Remove entry by ID or name match |
| `upload_document` | Extract structured entries from pasted documents |
| `get_status` | KB health check — configured status, entry counts, last update |
| `get_feedback_summary` | Delivery count, reaction breakdown, content performance |
| `get_outcomes` | Deals that received enablement → won/lost correlation |
| `get_field_signals` | Rep-submitted field intel over time |

### Rep Directory (3)

| Tool | Description |
|------|-------------|
| `add_rep` | Register rep with email, name, Slack ID, Telegram ID |
| `list_reps` | Show all reps with routing info |
| `remove_rep` | Remove rep from directory |

### Enablement Preview (1)

| Tool | Description |
|------|-------------|
| `generate_enablement` | Preview what a rep would receive for a given deal scenario — no CRM, Slack, or API keys needed |

---

## Supported CRMs

Auto-detected from payload shape. No configuration needed.

| CRM | Detection Method | Stage Field |
|-----|-----------------|-------------|
| HubSpot | `properties` key | `properties.dealstage` |
| Salesforce | `StageName` key | `StageName` |
| Attio | `attributes` key | `attributes.stage` |
| Pipedrive | `current` key | `current.stage_name` |
| Close | `lead` + `status_label` | `status_label` |
| Generic | Flat JSON | `deal_stage` |

---

## Rep Resolution Chain

When a webhook fires, the engine finds the right rep through a fallback chain:

```
1. CRM field         — payload includes Slack/Telegram ID directly
       ↓ not found
2. Rep directory     — lookup by email in rep-directory.json
       ↓ not found
3. Slack API         — users.lookupByEmail (auto-caches result)
       ↓ not found
4. Email fallback    — uses rep's email address
       ↓ not found (Telegram only)
5. PMM fallback      — sends to PMM's Telegram chat
```

---

## Message Format

**Slack** — Block Kit with structured sections:
```
┌─────────────────────────────────┐
│  JIT Enablement Alert           │
│  Deal: Acme Corp                │
│  Stage: Proposal Sent           │
│  Industry: Healthcare           │
├─────────────────────────────────┤
│  [Personalized enablement       │
│   content from KB entries]      │
├─────────────────────────────────┤
│  👍 Helpful    👎 Not helpful   │
│                                 │
│  Reply in thread with field     │
│  intel or signals               │
└─────────────────────────────────┘
```

**Telegram** — HTML-formatted with inline keyboard buttons and visual confirmation on click.

---

## Testing

```bash
npm test        # 215 tests, 4 test files
npm run test:watch
```

| Test File | Coverage |
|-----------|----------|
| `pipeline.test.ts` | CRM parsing, stage classification, rep resolution, prompt building, message formatting |
| `mcp.test.ts` | All 16 MCP tools with various inputs |
| `server.test.ts` | HTTP routes, auth, validation, sync endpoints |
| `feedback.test.ts` | Slack/Telegram callbacks, thread replies, call intel parsing |

---

## Deployment

### Railway (Recommended)

```bash
# 1. Push to GitHub
# 2. Create Railway project → Deploy from GitHub
# 3. Set env vars:
#    CHANNEL=slack (or telegram)
#    SLACK_BOT_TOKEN=xoxb-...
#    DATA_DIR=/app/data
# 4. Add persistent volume at /app/data
# 5. Generate public domain
# 6. Point CRM webhook to https://your-app.up.railway.app/webhook/crm
```

See [docs/deploy-railway.md](docs/deploy-railway.md) for the full guide (~10 minutes).

### Docker

```bash
docker build -t jit-enablement .
docker run -p 3456:3456 \
  -v $(pwd)/data:/app/data \
  -e SLACK_BOT_TOKEN=xoxb-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  jit-enablement
```

### Local Testing

```bash
npm run start:server
npx localtunnel --port 3456
# Use tunnel URL as CRM webhook endpoint
```

---

## Security

- **Context gate** — blocks delivery if KB has no case studies (prevents hallucination)
- **Prompt injection defense** — deal field values treated as plain text, never executed
- **Body size limits** — 100KB JSON, 500 char deal names, 10KB call intel summaries
- **Sync auth** — Bearer token validation for KB sync endpoints
- **Error isolation** — global handler never leaks stack traces
- **Unfurl disabled** — Slack messages don't preview external links

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Claude API for AI prose. Without it, uses template-based formatting |
| `SLACK_BOT_TOKEN` | Phase 2 (Slack) | `chat:write`, `users:read.email` scopes |
| `TELEGRAM_BOT_TOKEN` | Phase 2 (Telegram) | From BotFather |
| `CHANNEL` | No | `slack` (default) or `telegram` |
| `WEBHOOK_PORT` | No | Server port (default: 3456, Railway overrides with PORT) |
| `PMM_SLACK_ID` | No | Slack user ID for PMM notifications |
| `PMM_TELEGRAM_CHAT_ID` | No | Telegram chat ID for PMM notifications |
| `DATA_DIR` | No | Path to data directory (default: `./data`) |
| `SYNC_URL` | No | Remote server URL for KB auto-sync |
| `SYNC_SECRET` | No | Shared secret for sync authentication |

---

## Author

Built by **[Victor Ugochukwu](https://github.com/VicUgochukwu)** — a PMM who builds production GTM tools with code.

## License

MIT
