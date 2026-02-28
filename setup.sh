#!/bin/bash
set -e

# ──────────────────────────────────────────────────────────────
# JIT Sales Enablement Engine — Setup Script
#
# Zero-credential quick start. You can add case studies,
# competitor positioning, and methodology via Claude Code
# without any API keys. Keys are only needed when you're
# ready to connect the webhook server to your CRM + Slack.
# ──────────────────────────────────────────────────────────────

echo ""
echo "  JIT Sales Enablement Engine — Setup"
echo "  ─────────────────────────────────────"
echo ""

# ── 1. Check prerequisites ──────────────────────────────────

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    echo "  ERROR: $1 is not installed."
    echo "  $2"
    exit 1
  fi
}

check_cmd node "Install Node.js 18+: https://nodejs.org"
check_cmd npm "Comes with Node.js: https://nodejs.org"

NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  ERROR: Node.js 18+ required. You have v$(node -v)."
  echo "  Update at https://nodejs.org"
  exit 1
fi

echo "  ✓ Node.js $(node -v)"
echo "  ✓ npm $(npm -v)"

# ── 2. Install dependencies ─────────────────────────────────

echo ""
echo "  Installing dependencies..."
npm install --silent
echo "  ✓ Dependencies installed"

# ── 3. Build TypeScript ─────────────────────────────────────

echo ""
echo "  Building TypeScript..."
npm run build --silent
echo "  ✓ TypeScript compiled to dist/"

# ── 4. Create data directory with empty schemas ──────────────

if [ ! -d "data" ]; then
  mkdir -p data
fi

if [ ! -f "data/knowledge-base.json" ]; then
  cat > data/knowledge-base.json << 'KBEOF'
{
  "case_studies": [],
  "competitor_positioning": [],
  "objection_library": [],
  "methodology": null,
  "_meta": {
    "last_updated": null,
    "version": "1.0",
    "entry_count": 0,
    "configured": false
  }
}
KBEOF
  echo "  ✓ Created data/knowledge-base.json"
else
  echo "  ✓ data/knowledge-base.json already exists"
fi

if [ ! -f "data/feedback-log.json" ]; then
  cat > data/feedback-log.json << 'FBEOF'
{
  "deliveries": [],
  "feedback": [],
  "_meta": {
    "last_updated": null,
    "version": "1.0",
    "total_deliveries": 0,
    "total_feedback": 0
  }
}
FBEOF
  echo "  ✓ Created data/feedback-log.json"
else
  echo "  ✓ data/feedback-log.json already exists"
fi

if [ ! -f "data/rep-directory.json" ]; then
  cat > data/rep-directory.json << 'RDEOF'
{
  "reps": [],
  "_meta": {
    "last_updated": null,
    "version": "1.0",
    "total_reps": 0
  }
}
RDEOF
  echo "  ✓ Created data/rep-directory.json"
else
  echo "  ✓ data/rep-directory.json already exists"
fi

# ── 5. Create .env if not present ────────────────────────────

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ✓ Created .env from .env.example"
  echo ""
  echo "  ╭──────────────────────────────────────────────╮"
  echo "  │  Edit .env to add your API keys when ready.  │"
  echo "  │  KB management works without any keys.       │"
  echo "  ╰──────────────────────────────────────────────╯"
else
  echo "  ✓ .env already exists"
fi

# ── 6. Register MCP server with Claude Code ──────────────────

echo ""

if command -v claude &> /dev/null; then
  echo "  Registering MCP server with Claude Code..."
  claude mcp add jit-enablement \
    -e DATA_DIR="$PWD/data" \
    -- node "$PWD/dist/mcp/index.js" 2>/dev/null \
    && echo "  ✓ MCP server registered" \
    || echo "  ⚠ MCP registration failed — you can add it manually later"
else
  echo "  ⚠ Claude Code CLI not found. Install it first:"
  echo "    npm install -g @anthropic-ai/claude-code"
  echo ""
  echo "  Then register the MCP server manually:"
  echo "    claude mcp add jit-enablement -e DATA_DIR=\"$PWD/data\" -- node \"$PWD/dist/mcp/index.js\""
fi

# ── 7. Run tests ─────────────────────────────────────────────

echo ""
echo "  Running tests..."
if npm test --silent 2>/dev/null; then
  echo "  ✓ All tests pass"
else
  echo "  ⚠ Some tests failed — check output above"
fi

# ── 8. Print success ─────────────────────────────────────────

echo ""
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║                   Setup Complete!                     ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo ""
echo "  Phase 1: Manage your knowledge base (no API keys needed)"
echo "  ─────────────────────────────────────────────────────────"
echo "  Open Claude Code and try:"
echo "    \"Add a case study for Acme Corp in Financial Services..."
echo "     They saw a 45% pipeline velocity increase.\""
echo ""
echo "  Phase 2: Connect the webhook server (needs API keys)"
echo "  ─────────────────────────────────────────────────────────"
echo "  1. Edit .env with your ANTHROPIC_API_KEY and SLACK_BOT_TOKEN"
echo "  2. Run: npm run start:server"
echo "  3. Point your CRM webhook to: http://localhost:3456/webhook/crm"
echo ""
echo "  Docs: README.md | Skill guide: skill.md"
echo ""
