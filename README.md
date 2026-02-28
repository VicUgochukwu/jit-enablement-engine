# JIT Sales Enablement Engine

A self-contained sales enablement system that pushes personalized content to reps when CRM deals change stages. No n8n, no GitHub storage, no external workflow tools.

## Quick Start

```bash
git clone <your-repo-url> jit-enablement-engine
cd jit-enablement-engine
bash setup.sh
```

That's it. You can start managing your knowledge base in Claude Code immediately — no API keys needed for Phase 1.

## Architecture

```
                    ┌─────────────────────────┐
                    │      Claude Code         │
                    │   (PMM manages KB + reps │
                    │    via natural language)  │
                    └──────────┬──────────────┘
                               │ stdio
                    ┌──────────▼──────────────┐
                    │      MCP Server          │
                    │   16 tools:              │
                    │   KB mgmt (12) +         │
                    │   Rep directory (3) +    │
                    │   Enablement preview (1) │
                    └──────────┬──────────────┘
                               │ filesystem + HTTP sync
                    ┌──────────▼──────────────┐
                    │   data/ directory        │
                    │   ├── knowledge-base.json│  ──── auto-push ────┐
                    │   ├── feedback-log.json  │                     │
                    │   └── rep-directory.json │  ──── auto-push ────┤
                    └──────────┬──────────────┘                     │
                               │ filesystem                         │
                    ┌──────────▼──────────────┐          ┌──────────▼──┐
                    │   Express Webhook Server │◄─────────│  Railway /  │
                    │   POST /webhook/crm      │  sync    │  Render     │
                    │   POST /webhook/feedback  │  PUT     │  (remote)   │
                    │   POST /webhook/telegram  │  /api/kb │             │
                    │   POST /webhook/call-intel│         └─────────────┘
                    │   PUT  /api/kb            │
                    │   PUT  /api/rep-directory  │
                    └──────────┬──────────────┘
                               │ HTTP
                ┌──────────────┼──────────────────┐
                ▼              ▼                   ▼
        Claude API *      Slack API         Telegram API
        (* optional)
```

**Local mode:** Both MCP server and webhook server share the same `data/` directory.
**Deployed mode:** The MCP server auto-syncs KB and rep directory changes to your Railway server via `PUT /api/kb` and `PUT /api/rep-directory` (authenticated with a shared secret).

**Claude API is optional.** Without an API key, the engine assembles enablement packages directly from your KB content using template-based formatting. Add an API key to get AI-generated prose.

## Phases

### Phase 1: Foundation (Zero Credentials)
Build your knowledge base and register your sales reps using Claude Code. No API keys needed.

```
"Add a case study for Acme Corp..."
"Set methodology to MEDDIC..."
"Add rep Sarah Chen — her Slack ID is U0123ABC, email sarah@team.com"
"Show me all entries"
```

### Phase 2: Equip (Messaging Token Required)
Connect the webhook server to your CRM and messaging platform.

1. Add `SLACK_BOT_TOKEN` (or `TELEGRAM_BOT_TOKEN`) to `.env`
2. Optionally add `ANTHROPIC_API_KEY` for AI-generated prose (without it, the engine uses template-based formatting from your KB)
3. Start the server: `npm run start:server`
4. Point your CRM webhook to `http://your-server:3456/webhook/crm`

The engine resolves which rep to message using a resolution chain:
- CRM payload field → Rep directory lookup → Slack API email lookup (auto-caches) → email fallback

### Phase 3: Listen
Reps react to content (👍 helpful / 👎 not helpful), reply with field intel, and outcomes get tracked automatically. On Telegram, button clicks show instant visual confirmation (toast + button state change).

### Phase 4: Adapt
Use feedback data to update your KB. Ask Claude Code:
```
"How is my content performing?"
"What field signals have reps sent?"
"Any content flagged as not helpful?"
```

## Supported CRMs

| CRM | Detection | Stage Field |
|-----|-----------|-------------|
| HubSpot | `properties` key | `properties.dealstage` |
| Salesforce | `StageName` key | `StageName` |
| Attio | `attributes` key | `attributes.stage` |
| Pipedrive | `current` key | `current.stage_name` |
| Close | `lead` + `status_label` | `status_label` |
| Generic | Flat JSON | `deal_stage` |

The engine auto-detects CRM type from payload shape. No configuration needed.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:server` | Start the webhook server |
| `npm run start:mcp` | Start the MCP server (usually via Claude Code) |
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode compilation |
| `npm test` | Run all tests |
| `npm run test:watch` | Watch mode tests |

## Deployment

### Railway (Recommended)

Railway gives you a permanent public URL, auto-HTTPS, persistent storage, and automatic restarts — no server management.

**→ [Full Railway deployment guide](docs/deploy-railway.md)** — takes ~10 minutes.

The short version:
1. Push repo to GitHub
2. Create a Railway project → Deploy from GitHub repo
3. Set env vars (`CHANNEL`, `SLACK_BOT_TOKEN` or `TELEGRAM_BOT_TOKEN`, `DATA_DIR=/app/data`)
4. Add a persistent volume mounted at `/app/data`
5. Generate a public domain
6. Point your CRM webhook to `https://your-app.up.railway.app/webhook/crm`

### Local Testing

For local development and testing before deploying:

```bash
npm run start:server
# In another terminal:
npx localtunnel --port 3456
# Use the tunnel URL as your CRM webhook endpoint
```

### Docker

```bash
docker build -t jit-enablement .
docker run -p 3456:3456 \
  -v $(pwd)/data:/app/data \
  -e SLACK_BOT_TOKEN=xoxb-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  jit-enablement
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Claude API key. Optional — without it, enablement uses template-based formatting from your KB content |
| `SLACK_BOT_TOKEN` | Phase 2 (Slack) | Slack bot token with `chat:write`, `users:read.email` scopes |
| `TELEGRAM_BOT_TOKEN` | Phase 2 (Telegram) | Telegram bot token from BotFather |
| `CHANNEL` | No | `slack` (default) or `telegram` |
| `PORT` | No | Server port — auto-set by Railway/Render (takes priority) |
| `WEBHOOK_PORT` | No | Server port for local use (default: 3456) |
| `PMM_SLACK_ID` | No | Slack user ID for PMM notifications |
| `PMM_TELEGRAM_CHAT_ID` | No | Telegram chat ID for PMM notifications |
| `DATA_DIR` | No | Path to data directory (default: `./data`) |
| `SYNC_URL` | No (MCP only) | Railway/remote server URL for automatic KB sync |
| `SYNC_SECRET` | No | Shared secret for authenticating sync requests (set on both local + server) |

## Testing

```bash
npm test
```

215 tests across 4 test files covering the full pipeline, feedback parsing, server routes (including sync), and data layer.

## MCP Tools (16)

### Knowledge Base (12 tools)
| Tool | Description |
|------|-------------|
| `add_case_study` | Add a customer success story (with optional resource links) |
| `add_competitor` | Add competitor positioning (with optional resource links) |
| `add_objection` | Add an objection and recommended response to the library |
| `set_methodology` | Set sales methodology (MEDDIC, BANT, etc.) |
| `list_entries` | List all KB content (case studies, competitors, objections, methodology) |
| `search_entries` | Search KB by industry, competitor, or stage |
| `remove_entry` | Remove a KB entry by ID or name |
| `upload_document` | Extract content from pasted documents |
| `get_status` | Check system health and KB stats |
| `get_feedback_summary` | Summarize rep feedback and content performance |
| `get_outcomes` | Show deal outcomes correlated with content |
| `get_field_signals` | See what reps are reporting from the field |

### Enablement Preview (1 tool)
| Tool | Description |
|------|-------------|
| `generate_enablement` | Preview what a rep would receive for a given deal scenario — no CRM, Slack, or API keys needed |

### Rep Directory (3 tools)
| Tool | Description |
|------|-------------|
| `add_rep` | Register a sales rep (email, name, Slack ID, Telegram ID) |
| `list_reps` | Show all registered reps and their routing info |
| `remove_rep` | Remove a rep from the directory |

## Rep Resolution Chain

When a CRM webhook fires, the engine needs to know which messaging account to send to. It resolves this automatically:

1. **CRM field** — checks if the payload includes a Slack/Telegram ID directly
2. **Rep directory** — looks up the rep's email in `data/rep-directory.json`
3. **Slack API** — calls `users.lookupByEmail` and auto-caches the result back to the directory
4. **Email fallback** — uses the rep's email address as a last resort
5. **PMM fallback** (Telegram only) — sends to PMM if no rep-specific ID found
