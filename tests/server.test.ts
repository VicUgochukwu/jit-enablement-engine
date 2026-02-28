/**
 * Server route integration tests — uses supertest to hit
 * Express routes without starting an actual server.
 *
 * These tests verify HTTP response codes and response shapes.
 * The async pipeline processing is fire-and-forget (responds 200
 * immediately), so we test the response contract, not side effects.
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/server/index.js";
import type { Config } from "../src/shared/config.js";
import { resolve } from "path";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import {
  hubspotPayload,
  salesforcePayload,
  genericPayload,
  closedWonPayload,
  slackButtonPayload,
  slackVerificationPayload,
  telegramCallbackPayload,
  callIntelPayload,
} from "./fixtures/payloads.js";

// ── Test config with temp data directory ────────────────────

const testDataDir = resolve(import.meta.dirname, "__test-data-server__");

const testConfig: Config = {
  dataDir: testDataDir,
  kbPath: resolve(testDataDir, "knowledge-base.json"),
  feedbackLogPath: resolve(testDataDir, "feedback-log.json"),
  repDirectoryPath: resolve(testDataDir, "rep-directory.json"),
  anthropicApiKey: "sk-ant-test-key",
  slackBotToken: "xoxb-test-token",
  pmmSlackId: "U_PMM_TEST",
  telegramBotToken: "",
  pmmTelegramChatId: "",
  webhookPort: 0,
  channel: "slack",
  syncSecret: "test-sync-secret-123",
};

let app: Express;

beforeAll(() => {
  // Create temp data directory with empty schema files
  if (existsSync(testDataDir)) {
    rmSync(testDataDir, { recursive: true });
  }
  mkdirSync(testDataDir, { recursive: true });

  writeFileSync(
    testConfig.kbPath,
    JSON.stringify({
      case_studies: [],
      competitor_positioning: [],
      methodology: null,
      _meta: { last_updated: null, version: "1.0", entry_count: 0, configured: false },
    })
  );

  writeFileSync(
    testConfig.feedbackLogPath,
    JSON.stringify({
      deliveries: [],
      feedback: [],
      _meta: { last_updated: null, version: "1.0", total_deliveries: 0, total_feedback: 0 },
    })
  );

  writeFileSync(
    testConfig.repDirectoryPath,
    JSON.stringify({
      reps: [],
      _meta: { last_updated: null, version: "1.0", total_reps: 0 },
    })
  );

  app = createApp(testConfig);

  return () => {
    // Cleanup temp data directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true });
    }
  };
});

// ============================================================
// HEALTH CHECK
// ============================================================

describe("Health Check", () => {
  it("responds 200 with status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("jit-enablement-engine");
  });

  it("includes channel in health response", async () => {
    const res = await request(app).get("/health");

    expect(res.body.channel).toBe("slack");
  });
});

// ============================================================
// CRM WEBHOOK ROUTE
// ============================================================

describe("POST /webhook/crm", () => {
  it("accepts HubSpot payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/crm")
      .send(hubspotPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("accepts Salesforce payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/crm")
      .send(salesforcePayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("accepts generic payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/crm")
      .send(genericPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
  });

  it("accepts outcome payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/crm")
      .send(closedWonPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("accepts empty payload without crashing", async () => {
    const res = await request(app)
      .post("/webhook/crm")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
  });
});

// ============================================================
// FEEDBACK WEBHOOK ROUTE
// ============================================================

describe("POST /webhook/feedback", () => {
  it("returns Slack URL verification challenge", async () => {
    const res = await request(app)
      .post("/webhook/feedback")
      .send(slackVerificationPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe("abc123challenge");
  });

  it("accepts Slack button payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/feedback")
      .send(slackButtonPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("accepts unknown payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/feedback")
      .send({ random: "data" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ============================================================
// TELEGRAM WEBHOOK ROUTE
// ============================================================

describe("POST /webhook/telegram", () => {
  it("accepts Telegram callback with 200", async () => {
    const res = await request(app)
      .post("/webhook/telegram")
      .send(telegramCallbackPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("accepts empty payload with 200", async () => {
    const res = await request(app)
      .post("/webhook/telegram")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
  });
});

// ============================================================
// CALL INTEL WEBHOOK ROUTE
// ============================================================

describe("POST /webhook/call-intel", () => {
  it("accepts valid call intel with 200", async () => {
    const res = await request(app)
      .post("/webhook/call-intel")
      .send(callIntelPayload)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("rejects missing deal_name with 400", async () => {
    const res = await request(app)
      .post("/webhook/call-intel")
      .send({ summary: "Some intel" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("deal_name");
  });

  it("rejects missing summary with 400", async () => {
    const res = await request(app)
      .post("/webhook/call-intel")
      .send({ deal_name: "Acme Corp" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("summary");
  });

  it("rejects empty body with 400", async () => {
    const res = await request(app)
      .post("/webhook/call-intel")
      .send({})
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
  });
});

// ============================================================
// SYNC ROUTES
// ============================================================

describe("PUT /api/kb", () => {
  const validKB = {
    case_studies: [
      {
        id: "cs-001",
        company: "TestCorp",
        industry: "Technology",
        segment: "Enterprise",
        challenge: "Scaling issues",
        result: "50% improvement",
        metric: "50% faster",
        relevant_stages: ["Proposal Sent"],
        resources: [],
      },
    ],
    competitor_positioning: [],
    objection_library: [],
    methodology: null,
    _meta: {
      last_updated: new Date().toISOString(),
      version: "1.0",
      entry_count: 1,
      configured: true,
    },
  };

  it("syncs KB with valid auth", async () => {
    const res = await request(app)
      .put("/api/kb")
      .send(validKB)
      .set("Authorization", "Bearer test-sync-secret-123")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(true);
    expect(res.body.entries).toBe(1);
  });

  it("rejects request without auth header", async () => {
    const res = await request(app)
      .put("/api/kb")
      .send(validKB)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Authorization");
  });

  it("rejects request with wrong secret", async () => {
    const res = await request(app)
      .put("/api/kb")
      .send(validKB)
      .set("Authorization", "Bearer wrong-secret")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Invalid");
  });

  it("rejects malformed KB payload", async () => {
    const res = await request(app)
      .put("/api/kb")
      .send({ random: "data" })
      .set("Authorization", "Bearer test-sync-secret-123")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("case_studies");
  });

  it("rejects empty body", async () => {
    const res = await request(app)
      .put("/api/kb")
      .send({})
      .set("Authorization", "Bearer test-sync-secret-123")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/rep-directory", () => {
  const validRepDir = {
    reps: [
      {
        email: "sarah@team.com",
        name: "Sarah Chen",
        slack_id: "U0123ABC",
        telegram_chat_id: "532751028",
        registered_at: new Date().toISOString(),
        registered_via: "manual",
      },
    ],
    _meta: {
      last_updated: new Date().toISOString(),
      version: "1.0",
      total_reps: 1,
    },
  };

  it("syncs rep directory with valid auth", async () => {
    const res = await request(app)
      .put("/api/rep-directory")
      .send(validRepDir)
      .set("Authorization", "Bearer test-sync-secret-123")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(true);
    expect(res.body.reps).toBe(1);
  });

  it("rejects request without auth", async () => {
    const res = await request(app)
      .put("/api/rep-directory")
      .send(validRepDir)
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
  });

  it("rejects malformed rep directory", async () => {
    const res = await request(app)
      .put("/api/rep-directory")
      .send({ people: [] })
      .set("Authorization", "Bearer test-sync-secret-123")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("reps");
  });
});

describe("Sync: SYNC_SECRET not configured", () => {
  let noSyncApp: Express;

  beforeAll(() => {
    const noSyncConfig: Config = {
      ...testConfig,
      syncSecret: "",
    };
    noSyncApp = createApp(noSyncConfig);
  });

  it("returns 503 when SYNC_SECRET is not set", async () => {
    const res = await request(noSyncApp)
      .put("/api/kb")
      .send({ case_studies: [], _meta: { entry_count: 0 } })
      .set("Authorization", "Bearer anything")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(503);
    expect(res.body.error).toContain("not configured");
  });
});

// ============================================================
// 404 ON UNKNOWN ROUTES
// ============================================================

describe("Unknown Routes", () => {
  it("returns 404 for GET on webhook routes", async () => {
    const res = await request(app).get("/webhook/crm");

    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown path", async () => {
    const res = await request(app).get("/nonexistent");

    expect(res.status).toBe(404);
  });
});
