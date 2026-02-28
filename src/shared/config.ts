/**
 * Configuration — typed env var reader with validation.
 *
 * The MCP server needs only DATA_DIR.
 * The webhook server needs ANTHROPIC_API_KEY + messaging tokens.
 *
 * Fails fast with clear error messages on missing required vars.
 */

import { resolve } from "path";

export interface Config {
  // Data paths
  dataDir: string;
  kbPath: string;
  feedbackLogPath: string;
  repDirectoryPath: string;

  // Claude API (optional — omit for template-based enablement)
  anthropicApiKey: string;

  // Slack (primary)
  slackBotToken: string;
  pmmSlackId: string;

  // Telegram (secondary)
  telegramBotToken: string;
  pmmTelegramChatId: string;

  // Server
  webhookPort: number;
  channel: "slack" | "telegram";

  // Sync — shared secret for authenticating KB sync requests
  syncSecret: string;
}

/**
 * Load config for the webhook server (requires API key + messaging token).
 * Throws if required variables are missing.
 */
export function loadServerConfig(): Config {
  const dataDir = process.env.DATA_DIR || resolve(process.cwd(), "data");
  const channel = (process.env.CHANNEL || "slack") as "slack" | "telegram";

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!anthropicApiKey) {
    console.log(
      "[JIT] No ANTHROPIC_API_KEY set — enablement packages will use template-based " +
        "formatting from your KB content. Add an API key to .env to enable AI-generated prose."
    );
  }

  const slackBotToken = process.env.SLACK_BOT_TOKEN || "";
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";

  if (channel === "slack" && !slackBotToken) {
    throw new Error(
      "SLACK_BOT_TOKEN is required when CHANNEL=slack. Set it in your .env file."
    );
  }
  if (channel === "telegram" && !telegramBotToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is required when CHANNEL=telegram. Set it in your .env file."
    );
  }

  return {
    dataDir,
    kbPath: resolve(dataDir, "knowledge-base.json"),
    feedbackLogPath: resolve(dataDir, "feedback-log.json"),
    repDirectoryPath: resolve(dataDir, "rep-directory.json"),
    anthropicApiKey,
    slackBotToken,
    pmmSlackId: process.env.PMM_SLACK_ID || "",
    telegramBotToken,
    pmmTelegramChatId: process.env.PMM_TELEGRAM_CHAT_ID || "",
    // PORT is set automatically by Railway/Render; WEBHOOK_PORT is the local override
    webhookPort: parseInt(process.env.PORT || process.env.WEBHOOK_PORT || "3456", 10),
    channel,
    syncSecret: process.env.SYNC_SECRET || "",
  };
}

/**
 * MCP config — data paths + optional sync settings.
 */
export interface McpConfig {
  dataDir: string;
  kbPath: string;
  feedbackLogPath: string;
  repDirectoryPath: string;
  syncUrl: string;   // Remote server URL (e.g., https://my-app.up.railway.app)
  syncSecret: string; // Shared secret for authenticating sync pushes
}

/**
 * Load config for the MCP server (minimal — only needs data paths).
 * No API keys required since the MCP server just manages local files.
 * If SYNC_URL and SYNC_SECRET are set, KB changes will be pushed
 * to the remote webhook server automatically.
 */
export function loadMcpConfig(): McpConfig {
  const dataDir = process.env.DATA_DIR || resolve(process.cwd(), "data");

  return {
    dataDir,
    kbPath: resolve(dataDir, "knowledge-base.json"),
    feedbackLogPath: resolve(dataDir, "feedback-log.json"),
    repDirectoryPath: resolve(dataDir, "rep-directory.json"),
    syncUrl: process.env.SYNC_URL || "",
    syncSecret: process.env.SYNC_SECRET || "",
  };
}
