/**
 * Pipeline module tests — covers the full enablement pipeline
 * from CRM webhook to delivery logging.
 */

import { describe, it, expect } from "vitest";
import { classifyStage, extractStage, filterStage } from "../src/pipeline/filter.js";
import { parseCrmPayload } from "../src/pipeline/parse.js";
import { enrichDealContext } from "../src/pipeline/enrich.js";
import { resolveRepIdentity } from "../src/pipeline/resolve.js";
import { contextGate } from "../src/pipeline/gate.js";
import { buildPrompt } from "../src/pipeline/prompt.js";
import { buildTemplateEnablement } from "../src/pipeline/template.js";
import { formatSlackMessage } from "../src/pipeline/format-slack.js";
import { buildDeliveryEntry } from "../src/pipeline/log.js";
import { generateId, generateDeliveryId } from "../src/shared/id.js";
import type { DealContext } from "../src/shared/types.js";
import {
  hubspotPayload,
  salesforcePayload,
  attioPayload,
  pipedrivePayload,
  closePayload,
  genericPayload,
  minimalPayload,
  wrappedPayload,
  closedWonPayload,
  closedLostPayload,
} from "./fixtures/payloads.js";
import { emptyKB, configuredKB } from "./fixtures/knowledge-base.js";

// ============================================================
// STAGE FILTER
// ============================================================

describe("Stage Filter", () => {
  it("classifies Proposal Sent as enablement", () => {
    expect(classifyStage("Proposal Sent")).toBe("enablement");
  });

  it("classifies Negotiation as enablement", () => {
    expect(classifyStage("Negotiation")).toBe("enablement");
  });

  it("classifies Closed Won as outcome", () => {
    expect(classifyStage("Closed Won")).toBe("outcome");
  });

  it("classifies Closed Lost as outcome", () => {
    expect(classifyStage("Closed Lost")).toBe("outcome");
  });

  it("classifies Discovery as skip", () => {
    expect(classifyStage("Discovery")).toBe("skip");
  });

  it("classifies empty string as skip", () => {
    expect(classifyStage("")).toBe("skip");
  });

  it("filterStage matches custom stages", () => {
    expect(filterStage("Custom Stage", ["Custom Stage", "Another"])).toBe(true);
    expect(filterStage("Nope", ["Custom Stage"])).toBe(false);
  });
});

// ============================================================
// STAGE EXTRACTION
// ============================================================

describe("Stage Extraction", () => {
  it("extracts stage from HubSpot", () => {
    expect(extractStage(hubspotPayload)).toBe("Proposal Sent");
  });

  it("extracts stage from Salesforce", () => {
    expect(extractStage(salesforcePayload)).toBe("Negotiation");
  });

  it("extracts stage from Attio", () => {
    expect(extractStage(attioPayload)).toBe("Proposal Sent");
  });

  it("extracts stage from Pipedrive", () => {
    expect(extractStage(pipedrivePayload)).toBe("Negotiation");
  });

  it("extracts stage from Close", () => {
    expect(extractStage(closePayload)).toBe("Proposal Sent");
  });

  it("extracts stage from generic", () => {
    expect(extractStage(genericPayload)).toBe("Proposal Sent");
  });

  it("extracts stage from wrapped payload", () => {
    expect(extractStage(wrappedPayload)).toBe("Proposal Sent");
  });

  it("returns empty string for unknown format", () => {
    expect(extractStage({})).toBe("");
  });
});

// ============================================================
// CRM PAYLOAD PARSING
// ============================================================

describe("CRM Payload Parsing", () => {
  describe("HubSpot", () => {
    const deal = parseCrmPayload(hubspotPayload);

    it("detects CRM type", () => expect(deal._crm_type).toBe("hubspot"));
    it("extracts deal name", () => expect(deal.deal_name).toBe("Acme Corp Enterprise Platform"));
    it("extracts deal stage", () => expect(deal.deal_stage).toBe("Proposal Sent"));
    it("extracts company name", () => expect(deal.company_name).toBe("Acme Corp"));
    it("extracts industry", () => expect(deal.industry).toBe("Financial Services"));
    it("extracts competitor", () => expect(deal.competitor).toBe("Gong"));
    it("extracts deal size", () => expect(deal.deal_size).toBe(150000));
    it("extracts rep email", () => expect(deal.rep_email).toBe("sarah.chen@yourcompany.com"));
    it("extracts rep Slack ID", () => expect(deal.rep_slack_id).toBe("U04HUBSPOT1"));
    it("extracts notes", () => expect(deal.deal_notes).toContain("CFO"));
    it("extracts product interest", () => expect(deal.product_interest).toContain("Enterprise Platform"));
  });

  describe("Salesforce", () => {
    const deal = parseCrmPayload(salesforcePayload);

    it("detects CRM type", () => expect(deal._crm_type).toBe("salesforce"));
    it("extracts deal name", () => expect(deal.deal_name).toBe("GlobalTech Series B Expansion"));
    it("extracts deal stage", () => expect(deal.deal_stage).toBe("Negotiation"));
    it("extracts company name", () => expect(deal.company_name).toBe("GlobalTech Inc"));
    it("extracts industry", () => expect(deal.industry).toBe("SaaS / Technology"));
    it("extracts competitor", () => expect(deal.competitor).toBe("Outreach"));
    it("extracts deal size", () => expect(deal.deal_size).toBe(85000));
    it("extracts rep Slack ID", () => expect(deal.rep_slack_id).toBe("U04SFDC1"));
  });

  describe("Attio", () => {
    const deal = parseCrmPayload(attioPayload);

    it("detects CRM type", () => expect(deal._crm_type).toBe("attio"));
    it("extracts deal name", () => expect(deal.deal_name).toBe("DataSync Pro Deal"));
    it("extracts deal stage", () => expect(deal.deal_stage).toBe("Proposal Sent"));
    it("extracts company name", () => expect(deal.company_name).toBe("DataSync Health"));
    it("extracts industry", () => expect(deal.industry).toBe("Healthcare"));
    it("extracts deal size", () => expect(deal.deal_size).toBe(120000));
  });

  describe("Pipedrive", () => {
    const deal = parseCrmPayload(pipedrivePayload);

    it("detects CRM type", () => expect(deal._crm_type).toBe("pipedrive"));
    it("extracts deal name", () => expect(deal.deal_name).toBe("MedFlow Enterprise"));
    it("extracts deal stage", () => expect(deal.deal_stage).toBe("Negotiation"));
    it("extracts company name", () => expect(deal.company_name).toBe("MedFlow Inc"));
    it("extracts deal size", () => expect(deal.deal_size).toBe(95000));
  });

  describe("Close", () => {
    const deal = parseCrmPayload(closePayload);

    it("detects CRM type", () => expect(deal._crm_type).toBe("close"));
    it("extracts deal name", () => expect(deal.deal_name).toBe("TechStart Seed Round"));
    it("extracts deal stage", () => expect(deal.deal_stage).toBe("Proposal Sent"));
    it("extracts deal size", () => expect(deal.deal_size).toBe(45000));
  });

  describe("Generic", () => {
    const deal = parseCrmPayload(genericPayload);

    it("detects CRM type", () => expect(deal._crm_type).toBe("generic"));
    it("extracts deal name", () => expect(deal.deal_name).toBe("QuickStart SMB Deal"));
    it("extracts deal stage", () => expect(deal.deal_stage).toBe("Proposal Sent"));
    it("extracts company name", () => expect(deal.company_name).toBe("MedFlow Health"));
    it("extracts industry", () => expect(deal.industry).toBe("Healthcare"));
    it("extracts deal size", () => expect(deal.deal_size).toBe(25000));
  });

  describe("Minimal", () => {
    const deal = parseCrmPayload(minimalPayload);

    it("falls back to generic", () => expect(deal._crm_type).toBe("generic"));
    it("uses default deal name", () => expect(deal.deal_name).toBe("Unknown Deal"));
    it("extracts stage", () => expect(deal.deal_stage).toBe("Proposal Sent"));
    it("uses default company name", () => expect(deal.company_name).toBe("Unknown Company"));
    it("uses default industry", () => expect(deal.industry).toBe("Technology"));
    it("uses default competitor", () => expect(deal.competitor).toBe("Not specified"));
    it("uses default deal size", () => expect(deal.deal_size).toBe(0));
  });

  describe("Wrapped payload", () => {
    const deal = parseCrmPayload(wrappedPayload);

    it("unwraps body wrapper", () => expect(deal._crm_type).toBe("hubspot"));
    it("extracts deal name through wrapper", () => expect(deal.deal_name).toBe("Acme Corp Enterprise Platform"));
  });
});

// ============================================================
// DEAL ENRICHMENT
// ============================================================

describe("Deal Enrichment", () => {
  it("preserves existing values", () => {
    const deal = parseCrmPayload(hubspotPayload);
    const enriched = enrichDealContext(deal);
    expect(enriched.industry).toBe("Financial Services");
    expect(enriched.competitor).toBe("Gong");
  });

  it("applies defaults for empty values", () => {
    const deal = parseCrmPayload(minimalPayload);
    const enriched = enrichDealContext(deal);
    expect(enriched.industry).toBe("Technology");
    expect(enriched.competitor).toBe("Not specified");
    expect(enriched.deal_size).toBe(0);
  });
});

// ============================================================
// REP IDENTITY RESOLUTION
// ============================================================

describe("Rep Identity Resolution", () => {
  it("resolves from CRM Slack ID field", () => {
    const deal = parseCrmPayload(hubspotPayload);
    const resolved = resolveRepIdentity(deal);
    expect(resolved._identity_resolved).toBe(true);
    expect(resolved._resolution_method).toBe("crm_field");
    expect(resolved.rep_slack_id).toBe("U04HUBSPOT1");
  });

  it("falls back to email when no Slack ID", () => {
    const deal = parseCrmPayload(genericPayload);
    const resolved = resolveRepIdentity(deal);
    expect(resolved._identity_resolved).toBe(true);
    expect(resolved._resolution_method).toBe("email_fallback");
    expect(resolved.rep_slack_id).toBe("rep@yourcompany.com");
  });

  it("marks unresolved when no ID or email", () => {
    const deal = parseCrmPayload(minimalPayload);
    const resolved = resolveRepIdentity(deal);
    expect(resolved._identity_resolved).toBe(false);
    expect(resolved._resolution_method).toBe("unresolved");
  });
});

// ============================================================
// CONTEXT GATE
// ============================================================

describe("Context Gate", () => {
  it("blocks when KB is empty", () => {
    expect(contextGate(emptyKB)).toBe(false);
  });

  it("passes when KB is configured", () => {
    expect(contextGate(configuredKB)).toBe(true);
  });

  it("blocks when configured but no case studies", () => {
    const kbNoCases = {
      ...configuredKB,
      case_studies: [],
      _meta: { ...configuredKB._meta, configured: true },
    };
    expect(contextGate(kbNoCases)).toBe(false);
  });
});

// ============================================================
// PROMPT BUILDING
// ============================================================

describe("Prompt Building", () => {
  const deal = parseCrmPayload(hubspotPayload);
  const prompt = buildPrompt(deal, configuredKB);

  it("includes deal name", () => {
    expect(prompt).toContain("Acme Corp Enterprise Platform");
  });

  it("includes deal stage", () => {
    expect(prompt).toContain("Proposal Sent");
  });

  it("includes industry", () => {
    expect(prompt).toContain("Financial Services");
  });

  it("includes competitor", () => {
    expect(prompt).toContain("Gong");
  });

  it("injects case study company", () => {
    expect(prompt).toContain("FinServ Corp");
  });

  it("injects case study metric", () => {
    expect(prompt).toContain("45% pipeline velocity increase");
  });

  it("injects competitor positioning", () => {
    expect(prompt).toContain("real-time coaching");
  });

  it("injects methodology", () => {
    expect(prompt).toContain("MEDDIC");
  });

  it("includes critical constraints", () => {
    expect(prompt).toContain("CRITICAL CONSTRAINTS");
    expect(prompt).toContain("Do NOT invent, fabricate, or hallucinate");
  });

  it("handles empty KB gracefully", () => {
    const emptyPrompt = buildPrompt(deal, emptyKB);
    expect(emptyPrompt).toContain("No case studies available.");
    expect(emptyPrompt).toContain("No competitor positioning available.");
    expect(emptyPrompt).toContain("No specific sales methodology configured.");
    expect(emptyPrompt).toContain("No objection library entries.");
  });

  it("injects resource links for case studies", () => {
    expect(prompt).toContain("One Pager: https://canva.com/design/finserv-one-pager");
    expect(prompt).toContain("Full Case Study: https://notion.so/finserv-case-study");
  });

  it("injects resource links for competitor positioning", () => {
    expect(prompt).toContain("Battle Card: https://canva.com/design/gong-battlecard");
  });

  it("injects objection library entries", () => {
    expect(prompt).toContain("Your pricing is 30% higher than Gong");
    expect(prompt).toContain("the ROI more than covers the difference");
  });

  it("includes objection competitor tag", () => {
    expect(prompt).toContain("[vs. Gong]");
  });

  it("includes objection category", () => {
    expect(prompt).toContain("(Pricing");
    expect(prompt).toContain("(Switching Cost");
  });

  it("includes Objection Library section header", () => {
    expect(prompt).toContain("### Objection Library");
  });

  it("prioritizes objection library in task instructions", () => {
    expect(prompt).toContain("PRIORITIZE objections from the Objection Library");
  });
});

// ============================================================
// SLACK MESSAGE FORMATTING
// ============================================================

describe("Slack Message Formatting", () => {
  const deal = resolveRepIdentity(parseCrmPayload(hubspotPayload));
  const msg = formatSlackMessage(deal, "Test response", "del-test1", configuredKB);

  it("sets correct channel", () => {
    expect(msg.channel).toBe("U04HUBSPOT1");
  });

  it("includes deal name in header", () => {
    const headerBlock = msg.blocks[0];
    expect(headerBlock.text?.text).toContain("Acme Corp Enterprise Platform");
  });

  it("includes Claude response", () => {
    const contentBlock = msg.blocks[2];
    expect(contentBlock.text?.text).toBe("Test response");
  });

  it("has feedback action buttons", () => {
    const actionsBlock = msg.blocks[4];
    expect(actionsBlock.type).toBe("actions");
    expect(actionsBlock.elements).toHaveLength(2);
  });

  it("includes delivery ID in buttons", () => {
    const actionsBlock = msg.blocks[4];
    const helpfulBtn = actionsBlock.elements![0] as Record<string, unknown>;
    expect(helpfulBtn.value).toBe("del-test1");
    expect(helpfulBtn.action_id).toBe("feedback_helpful");
  });

  it("tracks surfaced case studies", () => {
    expect(msg.case_studies_surfaced).toContain("cs-001");
    expect(msg.case_studies_surfaced).toContain("cs-002");
  });

  it("tracks surfaced competitor positioning", () => {
    expect(msg.competitors_surfaced).toContain("cp-001");
  });

  it("has fallback text", () => {
    expect(msg.text).toContain("JIT Enablement");
  });
});

// ============================================================
// ID GENERATION
// ============================================================

describe("ID Generation", () => {
  it("generates sequential case study IDs", () => {
    const existing = [{ id: "cs-001" }, { id: "cs-002" }];
    expect(generateId("cs", existing)).toBe("cs-003");
  });

  it("starts at 001 with empty array", () => {
    expect(generateId("cs", [])).toBe("cs-001");
  });

  it("generates delivery IDs with prefix", () => {
    const id = generateDeliveryId();
    expect(id).toMatch(/^del-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("generates unique delivery IDs", () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateDeliveryId()));
    expect(ids.size).toBe(10);
  });
});

// ============================================================
// DELIVERY ENTRY BUILDING
// ============================================================

describe("Delivery Entry", () => {
  const deal = resolveRepIdentity(parseCrmPayload(hubspotPayload));
  const entry = buildDeliveryEntry(deal, configuredKB, "del-test99", "slack");

  it("includes delivery ID", () => {
    expect(entry.delivery_id).toBe("del-test99");
  });

  it("includes deal context", () => {
    expect(entry.deal_name).toBe("Acme Corp Enterprise Platform");
    expect(entry.deal_stage).toBe("Proposal Sent");
    expect(entry.industry).toBe("Financial Services");
    expect(entry.competitor).toBe("Gong");
  });

  it("includes rep ID", () => {
    expect(entry.rep_id).toBe("U04HUBSPOT1");
  });

  it("tracks surfaced content", () => {
    expect(entry.case_studies_surfaced).toContain("cs-001");
    expect(entry.competitors_surfaced).toContain("cp-001");
  });

  it("includes channel and timestamp", () => {
    expect(entry.channel).toBe("slack");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ============================================================
// OUTCOME CLASSIFICATION
// ============================================================

describe("Outcome Classification", () => {
  it("classifies Closed Won as outcome", () => {
    const stage = extractStage(closedWonPayload);
    expect(classifyStage(stage)).toBe("outcome");
  });

  it("classifies Closed Lost as outcome", () => {
    const stage = extractStage(closedLostPayload);
    expect(classifyStage(stage)).toBe("outcome");
  });

  it("parses outcome payload deal name", () => {
    const deal = parseCrmPayload(closedWonPayload);
    expect(deal.deal_name).toBe("Acme Corp Enterprise Platform");
  });
});

// ============================================================
// TEMPLATE-BASED ENABLEMENT (no Claude API required)
// ============================================================

describe("Template Enablement", () => {
  const baseDeal: DealContext = {
    deal_name: "Acme Corp Enterprise Platform",
    deal_stage: "Proposal Sent",
    company_name: "Acme Corp",
    industry: "Financial Services",
    competitor: "Gong",
    deal_size: 125000,
    deal_notes: "Budget approved Q1",
    product_interest: "Platform",
    rep_email: "sarah@team.com",
    rep_slack_id: "U0123ABC",
    _identity_resolved: true,
    _resolution_method: "directory_cache",
    _crm_type: "generic",
    _raw: {},
  };

  it("includes deal context header", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("DEAL CONTEXT");
    expect(output).toContain("Acme Corp");
    expect(output).toContain("Proposal Sent");
  });

  it("matches FinServ case study for Financial Services deal", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("FinServ Corp");
    expect(output).toContain("45% pipeline velocity increase");
  });

  it("includes case study resource links", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("One Pager");
    expect(output).toContain("canva.com/design/finserv-one-pager");
  });

  it("includes competitor positioning against Gong", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("COMPETITOR POSITIONING");
    expect(output).toContain("Gong");
    expect(output).toContain("real-time coaching");
  });

  it("includes competitor resource links", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("Battle Card");
    expect(output).toContain("canva.com/design/gong-battlecard");
  });

  it("includes relevant objections", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("TOP OBJECTION RESPONSES");
    expect(output).toContain("pricing is 30% higher");
  });

  it("includes objection response text", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("ROI more than covers the difference");
  });

  it("includes methodology guidance", () => {
    const output = buildTemplateEnablement(baseDeal, configuredKB);
    expect(output).toContain("METHODOLOGY: MEDDIC");
    expect(output).toContain("Metrics and Decision Criteria");
  });

  it("shows fallback for unknown competitor", () => {
    const deal = { ...baseDeal, competitor: "Clari" };
    const output = buildTemplateEnablement(deal, configuredKB);
    expect(output).toContain("No positioning available against Clari");
  });

  it("shows fallback for empty case studies", () => {
    const kbNoCases = { ...configuredKB, case_studies: [], _meta: { ...configuredKB._meta, configured: true } };
    const output = buildTemplateEnablement(baseDeal, kbNoCases);
    expect(output).toContain("No matching case studies");
  });

  it("matches general objections when no competitor-specific ones exist", () => {
    const deal = { ...baseDeal, competitor: "SomeUnknown" };
    const output = buildTemplateEnablement(deal, configuredKB);
    // The "already have a conversation intelligence tool" objection is general (no competitor)
    // and relevant to Proposal Sent stage — it should still appear
    expect(output).toContain("conversation intelligence tool");
  });

  it("suppresses competitor section for unspecified competitor", () => {
    const deal = { ...baseDeal, competitor: "Not specified" };
    const output = buildTemplateEnablement(deal, configuredKB);
    expect(output).not.toContain("No positioning available against Not specified");
  });
});

// ============================================================
// GENERATE ENABLEMENT — manual trigger (no CRM webhook)
// ============================================================

describe("Generate Enablement (manual trigger)", () => {
  it("enrichDealContext fills defaults for empty fields", () => {
    const deal: DealContext = {
      deal_name: "Test Deal",
      deal_stage: "Proposal Sent",
      company_name: "Test Co",
      industry: "",
      competitor: "",
      deal_size: 0,
      deal_notes: "",
      product_interest: "",
      rep_email: "",
      rep_slack_id: "",
      _identity_resolved: false,
      _resolution_method: "manual",
      _crm_type: "generic",
      _raw: {},
    };
    const enriched = enrichDealContext(deal);
    expect(enriched.industry).toBe("Technology");
    expect(enriched.competitor).toBe("Not specified");
  });

  it("contextGate blocks when KB is empty", () => {
    expect(contextGate(emptyKB)).toBe(false);
  });

  it("contextGate passes when KB is configured", () => {
    expect(contextGate(configuredKB)).toBe(true);
  });

  it("full manual flow produces enablement content", () => {
    const deal: DealContext = {
      deal_name: "Acme Corp",
      deal_stage: "Proposal Sent",
      company_name: "Acme Corp",
      industry: "Financial Services",
      competitor: "Gong",
      deal_size: 50000,
      deal_notes: "",
      product_interest: "",
      rep_email: "",
      rep_slack_id: "",
      _identity_resolved: false,
      _resolution_method: "manual",
      _crm_type: "generic",
      _raw: {},
    };

    const enriched = enrichDealContext(deal);
    expect(contextGate(configuredKB)).toBe(true);

    const content = buildTemplateEnablement(enriched, configuredKB);
    // Should have all sections
    expect(content).toContain("DEAL CONTEXT");
    expect(content).toContain("FinServ Corp");       // Case study
    expect(content).toContain("real-time coaching");  // Competitor positioning
    expect(content).toContain("METHODOLOGY: MEDDIC"); // Methodology
    expect(content).toContain("OBJECTION RESPONSES"); // Objections
  });
});
