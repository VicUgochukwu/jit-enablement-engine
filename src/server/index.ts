#!/usr/bin/env node

/**
 * JIT Sales Enablement Engine — Webhook Server
 *
 * Express server that replaces n8n.
 * Receives CRM webhooks, runs the enablement pipeline,
 * and handles feedback collection.
 *
 * Entry point: node dist/server/index.js
 */

import express from "express";
import type { Express } from "express";
import { loadServerConfig } from "../shared/config.js";
import type { Config } from "../shared/config.js";
import { requestLogger, errorHandler } from "./middleware.js";
import { createCrmRouter } from "./routes/crm.js";
import { createFeedbackRouter } from "./routes/feedback.js";
import { createTelegramRouter } from "./routes/telegram.js";
import { createCallIntelRouter } from "./routes/call-intel.js";
import { createSyncRouter } from "./routes/sync.js";

/**
 * Create the Express app with all routes.
 * Exported as a factory for testing (supertest).
 */
export function createApp(config: Config): Express {
  const app = express();

  // ── Security hardening ──────────────────────────────────
  // Disable X-Powered-By header (leaks framework info)
  app.disable("x-powered-by");

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0"); // Modern best practice: disable legacy XSS filter
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // ── Body parsing with size limits ───────────────────────
  // Webhook payloads are small JSON — 100kb is generous but prevents abuse
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // Request logging
  app.use(requestLogger);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "jit-enablement-engine",
      channel: config.channel,
      port: config.webhookPort,
    });
  });

  // Webhook routes
  app.use("/webhook/crm", createCrmRouter(config));
  app.use("/webhook/feedback", createFeedbackRouter(config));
  app.use("/webhook/telegram", createTelegramRouter(config));
  app.use("/webhook/call-intel", createCallIntelRouter(config));

  // Sync routes (KB + rep directory push from MCP server)
  app.use("/api", createSyncRouter(config));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

// ── Start server if run directly ─────────────────────────

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("server/index.js");

if (isMainModule) {
  try {
    const config = loadServerConfig();
    const app = createApp(config);

    app.listen(config.webhookPort, () => {
      console.log("");
      console.log("JIT Sales Enablement Engine");
      console.log("─────────────────────────────────────────");
      console.log(`  Webhook server running on port ${config.webhookPort}`);
      console.log(`  Channel: ${config.channel}`);
      console.log("");
      console.log("  Routes:");
      console.log(`    POST /webhook/crm          → CRM deal stage changes`);
      console.log(`    POST /webhook/feedback      → Slack interactions`);
      console.log(`    POST /webhook/telegram      → Telegram bot updates`);
      console.log(`    POST /webhook/call-intel    → Call intel submissions`);
      console.log(`    PUT  /api/kb               → KB sync from MCP server`);
      console.log(`    PUT  /api/rep-directory     → Rep directory sync`);
      console.log(`    GET  /health               → Health check`);
      if (config.syncSecret) {
        console.log("");
        console.log("  Sync: ENABLED (SYNC_SECRET configured)");
      }
      console.log("");
      console.log("  Ready to receive webhooks.");
      console.log("");
    });
  } catch (err) {
    console.error("Failed to start server:", (err as Error).message);
    process.exit(1);
  }
}
