/**
 * MCP / Data layer tests — verifies the shared data operations
 * that underpin the MCP server's 10 tools.
 *
 * The MCP server uses stdio transport (not HTTP), so we test
 * the data layer functions directly. These are the same functions
 * that every MCP tool handler calls.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve } from "path";
import { mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from "fs";
import {
  readKB,
  writeKB,
  readFeedbackLog,
  appendDelivery,
  appendFeedback,
} from "../src/shared/data.js";
import { generateId, generateDeliveryId, generateFeedbackId } from "../src/shared/id.js";
import type {
  KnowledgeBase,
  CaseStudy,
  CompetitorPositioning,
} from "../src/shared/types.js";
import { emptyKB, configuredKB, emptyFeedbackLog, populatedFeedbackLog } from "./fixtures/knowledge-base.js";

// ── Temp data directory ─────────────────────────────────────

const testDataDir = resolve(import.meta.dirname, "__test-data-mcp__");
const kbPath = resolve(testDataDir, "knowledge-base.json");
const feedbackLogPath = resolve(testDataDir, "feedback-log.json");

beforeAll(() => {
  if (existsSync(testDataDir)) {
    rmSync(testDataDir, { recursive: true });
  }
  mkdirSync(testDataDir, { recursive: true });
});

afterAll(() => {
  if (existsSync(testDataDir)) {
    rmSync(testDataDir, { recursive: true });
  }
});

// ============================================================
// KNOWLEDGE BASE READ/WRITE
// ============================================================

describe("Knowledge Base Read/Write", () => {
  it("writes and reads back an empty KB", () => {
    writeKB(kbPath, emptyKB);
    const kb = readKB(kbPath);

    expect(kb.case_studies).toHaveLength(0);
    expect(kb.competitor_positioning).toHaveLength(0);
    expect(kb.methodology).toBeNull();
    expect(kb._meta.configured).toBe(false);
  });

  it("writes and reads back a configured KB", () => {
    writeKB(kbPath, configuredKB);
    const kb = readKB(kbPath);

    expect(kb.case_studies).toHaveLength(2);
    expect(kb.competitor_positioning).toHaveLength(2);
    expect(kb.methodology).not.toBeNull();
    expect(kb.methodology?.name).toBe("MEDDIC");
    expect(kb._meta.configured).toBe(true);
  });

  it("updates entry_count automatically", () => {
    const kb = readKB(kbPath);
    expect(kb._meta.entry_count).toBe(7); // 2 case studies + 2 competitors + 2 objections + 1 methodology
  });

  it("updates last_updated timestamp", () => {
    writeKB(kbPath, configuredKB);
    const kb = readKB(kbPath);
    expect(kb._meta.last_updated).not.toBeNull();
    expect(kb._meta.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ============================================================
// ADD CASE STUDY (simulates MCP tool)
// ============================================================

describe("Add Case Study", () => {
  it("adds a case study and persists it", () => {
    writeKB(kbPath, { ...emptyKB });
    const kb = readKB(kbPath);

    const id = generateId("cs", kb.case_studies);
    const entry: CaseStudy = {
      id,
      company: "TestCo",
      industry: "SaaS",
      segment: "Mid-market",
      challenge: "Low pipeline velocity",
      result: "45% increase in pipeline velocity",
      metric: "45% pipeline velocity increase",
      relevant_stages: ["Proposal Sent"],
      resources: [],
    };

    kb.case_studies.push(entry);
    writeKB(kbPath, kb);

    const saved = readKB(kbPath);
    expect(saved.case_studies).toHaveLength(1);
    expect(saved.case_studies[0].company).toBe("TestCo");
    expect(saved.case_studies[0].id).toBe("cs-001");
    expect(saved._meta.configured).toBe(true);
    expect(saved._meta.entry_count).toBe(1);
  });

  it("increments IDs sequentially", () => {
    const kb = readKB(kbPath);
    const id2 = generateId("cs", kb.case_studies);
    expect(id2).toBe("cs-002");
  });
});

// ============================================================
// ADD COMPETITOR POSITIONING (simulates MCP tool)
// ============================================================

describe("Add Competitor Positioning", () => {
  it("adds competitor positioning and persists it", () => {
    writeKB(kbPath, { ...emptyKB });
    const kb = readKB(kbPath);

    const id = generateId("cp", kb.competitor_positioning);
    const entry: CompetitorPositioning = {
      id,
      competitor: "Gong",
      differentiator: "We offer real-time coaching during live calls",
      category: "Conversation Intelligence",
      supporting_evidence: "3 customers switched from Gong",
      resources: [],
    };

    kb.competitor_positioning.push(entry);
    writeKB(kbPath, kb);

    const saved = readKB(kbPath);
    expect(saved.competitor_positioning).toHaveLength(1);
    expect(saved.competitor_positioning[0].competitor).toBe("Gong");
    expect(saved.competitor_positioning[0].id).toBe("cp-001");
  });
});

// ============================================================
// SET METHODOLOGY (simulates MCP tool)
// ============================================================

describe("Set Methodology", () => {
  it("sets methodology and persists it", () => {
    writeKB(kbPath, { ...emptyKB });
    const kb = readKB(kbPath);

    kb.methodology = {
      name: "BANT",
      description: "Budget, Authority, Need, Timeline",
      stage_guidance: {
        "Proposal Sent": "Confirm budget holder sign-off",
      },
    };
    writeKB(kbPath, kb);

    const saved = readKB(kbPath);
    expect(saved.methodology).not.toBeNull();
    expect(saved.methodology?.name).toBe("BANT");
    expect(saved.methodology?.stage_guidance["Proposal Sent"]).toContain("budget");
  });
});

// ============================================================
// REMOVE ENTRY (simulates MCP tool)
// ============================================================

describe("Remove Entry", () => {
  it("removes case study by ID", () => {
    writeKB(kbPath, { ...configuredKB });
    const kb = readKB(kbPath);

    const idx = kb.case_studies.findIndex((cs) => cs.id === "cs-001");
    expect(idx).toBeGreaterThanOrEqual(0);
    kb.case_studies.splice(idx, 1);
    writeKB(kbPath, kb);

    const saved = readKB(kbPath);
    expect(saved.case_studies).toHaveLength(1);
    expect(saved.case_studies[0].id).toBe("cs-002");
  });

  it("removes competitor by name match", () => {
    writeKB(kbPath, { ...configuredKB });
    const kb = readKB(kbPath);

    const idx = kb.competitor_positioning.findIndex((cp) =>
      cp.competitor.toLowerCase().includes("gong")
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    kb.competitor_positioning.splice(idx, 1);
    writeKB(kbPath, kb);

    const saved = readKB(kbPath);
    expect(saved.competitor_positioning).toHaveLength(1);
    expect(saved.competitor_positioning[0].competitor).toBe("Outreach");
  });
});

// ============================================================
// SEARCH ENTRIES (simulates MCP tool)
// ============================================================

describe("Search Entries", () => {
  it("filters case studies by industry", () => {
    const kb = configuredKB;
    const matches = kb.case_studies.filter((cs) =>
      cs.industry.toLowerCase().includes("financial")
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].company).toBe("FinServ Corp");
  });

  it("filters case studies by stage relevance", () => {
    const kb = configuredKB;
    const matches = kb.case_studies.filter((cs) =>
      cs.relevant_stages.some((s) =>
        s.toLowerCase().includes("negotiation")
      )
    );
    expect(matches).toHaveLength(1);
  });

  it("filters competitor positioning by name", () => {
    const kb = configuredKB;
    const matches = kb.competitor_positioning.filter((cp) =>
      cp.competitor.toLowerCase().includes("gong")
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].differentiator).toContain("real-time coaching");
  });
});

// ============================================================
// FEEDBACK LOG READ/WRITE
// ============================================================

describe("Feedback Log Read/Write", () => {
  it("writes and reads back empty feedback log", () => {
    writeFileSync(
      feedbackLogPath,
      JSON.stringify(emptyFeedbackLog, null, 2)
    );

    const log = readFeedbackLog(feedbackLogPath);
    expect(log.deliveries).toHaveLength(0);
    expect(log.feedback).toHaveLength(0);
  });
});

// ============================================================
// APPEND DELIVERY
// ============================================================

describe("Append Delivery", () => {
  it("appends a delivery entry", () => {
    // Reset with empty log
    writeFileSync(
      feedbackLogPath,
      JSON.stringify(emptyFeedbackLog, null, 2)
    );

    const deliveryEntry = populatedFeedbackLog.deliveries[0];
    appendDelivery(feedbackLogPath, deliveryEntry);

    const log = readFeedbackLog(feedbackLogPath);
    expect(log.deliveries).toHaveLength(1);
    expect(log.deliveries[0].delivery_id).toBe("del-test123");
    expect(log._meta.total_deliveries).toBe(1);
  });
});

// ============================================================
// APPEND FEEDBACK
// ============================================================

describe("Append Feedback", () => {
  it("appends a feedback entry", () => {
    const feedbackEntry = populatedFeedbackLog.feedback[0];
    appendFeedback(feedbackLogPath, feedbackEntry);

    const log = readFeedbackLog(feedbackLogPath);
    expect(log.feedback).toHaveLength(1);
    expect(log.feedback[0].source).toBe("reaction");
    expect(log._meta.total_feedback).toBe(1);
  });
});

// ============================================================
// ID GENERATION
// ============================================================

describe("ID Generation (MCP context)", () => {
  it("generates cs-001 for empty case studies", () => {
    expect(generateId("cs", [])).toBe("cs-001");
  });

  it("generates cp-001 for empty competitors", () => {
    expect(generateId("cp", [])).toBe("cp-001");
  });

  it("generates delivery IDs with del- prefix", () => {
    const id = generateDeliveryId();
    expect(id).toMatch(/^del-/);
  });

  it("generates feedback IDs with fb- prefix", () => {
    const id = generateFeedbackId();
    expect(id).toMatch(/^fb-/);
  });

  it("delivery IDs are unique across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateDeliveryId()));
    expect(ids.size).toBe(20);
  });
});

// ============================================================
// KB META INVARIANTS
// ============================================================

describe("KB Meta Invariants", () => {
  it("marks KB as configured when case studies exist", () => {
    writeKB(kbPath, configuredKB);
    const kb = readKB(kbPath);
    expect(kb._meta.configured).toBe(true);
  });

  it("marks KB as not configured when empty", () => {
    writeKB(kbPath, emptyKB);
    const kb = readKB(kbPath);
    expect(kb._meta.configured).toBe(false);
  });

  it("counts all entries correctly", () => {
    writeKB(kbPath, configuredKB);
    const kb = readKB(kbPath);
    // 2 case studies + 2 competitors + 2 objections + 1 methodology = 7
    expect(kb._meta.entry_count).toBe(7);
  });

  it("counts entries with no methodology", () => {
    const kbNoMeth = { ...configuredKB, methodology: null };
    writeKB(kbPath, kbNoMeth);
    const kb = readKB(kbPath);
    // 2 case studies + 2 competitors + 2 objections = 6
    expect(kb._meta.entry_count).toBe(6);
  });
});
