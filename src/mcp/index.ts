#!/usr/bin/env node

/**
 * JIT Sales Enablement — MCP Server
 *
 * A Claude Code MCP server that lets PMMs manage their
 * sales enablement knowledge base by chatting with Claude.
 *
 * The knowledge base is a local JSON file. No databases,
 * no external services, no API keys needed.
 *
 * PMM says: "Add a case study for FinServ Corp..."
 * Claude calls: add_case_study tool
 * Result: Entry written to data/knowledge-base.json
 *
 * Entry point: node dist/mcp/index.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadMcpConfig } from "../shared/config.js";
import { readKB, writeKB, readFeedbackLog, readRepDirectory, upsertRep, removeRep, enableSync } from "../shared/data.js";
import { generateId } from "../shared/id.js";
import { enrichDealContext } from "../pipeline/enrich.js";
import { contextGate } from "../pipeline/gate.js";
import { buildTemplateEnablement } from "../pipeline/template.js";
import type {
  CaseStudy,
  CompetitorPositioning,
  ObjectionEntry,
  ResourceLink,
  KnowledgeBase,
  DealContext,
} from "../shared/types.js";

const config = loadMcpConfig();

// ── Remote sync — push KB/rep changes to Railway webhook server ──
if (config.syncUrl && config.syncSecret) {
  enableSync(config.syncUrl, config.syncSecret);
} else if (config.syncUrl && !config.syncSecret) {
  console.error("[JIT] SYNC_URL is set but SYNC_SECRET is missing — sync disabled");
}

const server = new McpServer({
  name: "jit-enablement",
  version: "1.0.0",
});

// ── Tool: add_case_study ────────────────────────────────────

server.tool(
  "add_case_study",
  "Add a customer case study to the knowledge base. The PMM provides the company name, industry, and results. This becomes available to the sales enablement webhook server.",
  {
    company: z.string().describe("Customer company name (e.g., 'Acme Corp')"),
    industry: z.string().describe("Customer's industry (e.g., 'Financial Services', 'Healthcare', 'SaaS')"),
    segment: z.string().default("Mid-market").describe("Customer segment: 'Enterprise', 'Mid-market', or 'SMB'"),
    challenge: z.string().describe("The business challenge they faced (1-2 sentences)"),
    result: z.string().describe("The outcome after using your product (1-2 sentences with specific metrics)"),
    metric: z.string().describe("The headline metric (e.g., '45% pipeline velocity increase')"),
    relevant_stages: z.array(z.string()).default(["Proposal Sent", "Negotiation"]).describe("Deal stages where this case study is most relevant"),
    resources: z.array(z.object({
      label: z.string().describe("Display name (e.g., 'One Pager', 'Full Deck', 'Notion Brief')"),
      url: z.string().describe("URL to the resource (Canva, Notion, Google Docs, etc.)"),
    })).default([]).describe("Optional links to supporting materials — Canva one-pagers, Notion docs, slide decks, etc."),
  },
  async ({ company, industry, segment, challenge, result, metric, relevant_stages, resources }) => {
    const kb = readKB(config.kbPath);
    const id = generateId("cs", kb.case_studies);

    const entry: CaseStudy = {
      id, company, industry, segment, challenge, result, metric, relevant_stages, resources,
    };

    kb.case_studies.push(entry);
    writeKB(config.kbPath, kb);

    return {
      content: [{
        type: "text" as const,
        text: `Added case study "${company}" (${industry}, ${segment}) with ID ${id}.\n\nKnowledge base now has ${kb._meta.entry_count} entries (${kb.case_studies.length} case studies, ${kb.competitor_positioning.length} competitor positions).`,
      }],
    };
  }
);

// ── Tool: add_competitor ────────────────────────────────────

server.tool(
  "add_competitor",
  "Add competitive positioning against a specific competitor. This gives sales reps a sharp one-liner to use in conversations.",
  {
    competitor: z.string().describe("Competitor name (e.g., 'Gong', 'Outreach', 'Salesloft')"),
    differentiator: z.string().describe("Your key differentiator against this competitor (1-2 sentences the rep can use verbatim)"),
    category: z.string().default("General").describe("Category of competition (e.g., 'Conversation Intelligence', 'Sales Engagement', 'CRM')"),
    supporting_evidence: z.string().default("").describe("Optional supporting evidence or data point"),
    resources: z.array(z.object({
      label: z.string().describe("Display name (e.g., 'Battle Card', 'Compete Sheet')"),
      url: z.string().describe("URL to the resource (Canva, Notion, Google Docs, etc.)"),
    })).default([]).describe("Optional links to supporting materials — battle cards, compete sheets, etc."),
  },
  async ({ competitor, differentiator, category, supporting_evidence, resources }) => {
    const kb = readKB(config.kbPath);
    const id = generateId("cp", kb.competitor_positioning);

    const entry: CompetitorPositioning = {
      id, competitor, differentiator, category, supporting_evidence, resources,
    };

    kb.competitor_positioning.push(entry);
    writeKB(config.kbPath, kb);

    return {
      content: [{
        type: "text" as const,
        text: `Added competitive positioning against "${competitor}" with ID ${id}.\n\nYou now have positioning against ${kb.competitor_positioning.length} competitor(s).`,
      }],
    };
  }
);

// ── Tool: set_methodology ───────────────────────────────────

server.tool(
  "set_methodology",
  "Set or update your team's sales methodology (MEDDIC, BANT, Challenger, etc.). This guides how Claude frames objection responses.",
  {
    name: z.string().describe("Methodology name (e.g., 'MEDDIC', 'BANT', 'Challenger Sale')"),
    description: z.string().describe("Brief description of the methodology and its key components"),
    stage_guidance: z.record(z.string(), z.string()).default({}).describe("Stage-specific guidance. Keys are deal stages, values are what to focus on."),
  },
  async ({ name, description, stage_guidance }) => {
    const kb = readKB(config.kbPath);
    kb.methodology = { name, description, stage_guidance };
    writeKB(config.kbPath, kb);

    const stageCount = Object.keys(stage_guidance).length;
    return {
      content: [{
        type: "text" as const,
        text: `Set sales methodology to "${name}" with guidance for ${stageCount} stage(s).\n\nAll enablement content will now be framed using ${name} principles.`,
      }],
    };
  }
);

// ── Tool: add_objection ───────────────────────────────────

server.tool(
  "add_objection",
  "Add an objection and its recommended response to the objection library. These get surfaced to reps when relevant to their deal stage and competitor.",
  {
    objection: z.string().describe("The objection the buyer raises (e.g., 'Your pricing is too high compared to Gong')"),
    response: z.string().describe("The recommended response the rep should use (2-3 sentences, verbatim-ready)"),
    competitor: z.string().default("").describe("Which competitor this objection relates to (leave blank if it's general)"),
    category: z.string().default("General").describe("Category (e.g., 'Pricing', 'Security', 'Integration', 'ROI', 'Switching Cost')"),
    relevant_stages: z.array(z.string()).default(["Proposal Sent", "Negotiation"]).describe("Deal stages where this objection typically comes up"),
  },
  async ({ objection, response, competitor, category, relevant_stages }) => {
    const kb = readKB(config.kbPath);
    const id = generateId("ob", kb.objection_library);

    const entry: ObjectionEntry = {
      id, objection, response, competitor, category, relevant_stages,
    };

    kb.objection_library.push(entry);
    writeKB(config.kbPath, kb);

    return {
      content: [{
        type: "text" as const,
        text: `Added objection "${objection.slice(0, 60)}..." to the library with ID ${id}.\n\n` +
          `Category: ${category}${competitor ? ` | Competitor: ${competitor}` : ""}\n` +
          `Objection library now has ${kb.objection_library.length} entries.`,
      }],
    };
  }
);

// ── Tool: generate_enablement ──────────────────────────────

server.tool(
  "generate_enablement",
  "Generate an enablement package for a deal — preview what a rep would receive. Works without CRM webhooks, Slack tokens, or API keys. Assembles the most relevant case study, competitor positioning, objections, and methodology guidance from your knowledge base.",
  {
    deal_name: z.string().describe("Deal name (e.g., 'Acme Corp Enterprise Platform')"),
    deal_stage: z.string().default("Proposal Sent").describe("Current deal stage (e.g., 'Proposal Sent', 'Negotiation')"),
    company_name: z.string().default("").describe("Company name (defaults to deal name if not provided)"),
    industry: z.string().default("").describe("Industry (e.g., 'Financial Services', 'Healthcare', 'SaaS')"),
    competitor: z.string().default("").describe("Competitor on the deal (e.g., 'Gong', 'Outreach')"),
    deal_size: z.number().default(0).describe("Deal size in dollars (optional)"),
    deal_notes: z.string().default("").describe("Additional context or notes about the deal (optional)"),
  },
  async ({ deal_name, deal_stage, company_name, industry, competitor, deal_size, deal_notes }) => {
    const kb = readKB(config.kbPath);

    if (!contextGate(kb)) {
      return {
        content: [{
          type: "text" as const,
          text: "Cannot generate enablement package — knowledge base is empty or not configured.\n\n" +
            "Add at least one case study first:\n" +
            "  \"Add a case study for FinServ Corp in Financial Services. They saw 45% pipeline velocity increase.\"\n\n" +
            "Then try again.",
        }],
      };
    }

    // Build deal context from the conversational parameters
    const deal: DealContext = {
      deal_name,
      deal_stage,
      company_name: company_name || deal_name,
      industry,
      competitor,
      deal_size,
      deal_notes,
      product_interest: "",
      rep_email: "",
      rep_slack_id: "",
      _identity_resolved: false,
      _resolution_method: "manual",
      _crm_type: "generic",
      _raw: {},
    };

    // Enrich with defaults (fills in "Technology" for empty industry, etc.)
    const enrichedDeal = enrichDealContext(deal);

    // Generate the enablement package from KB content
    const content = buildTemplateEnablement(enrichedDeal, kb);

    const competitorNote = enrichedDeal.competitor !== "Not specified"
      ? ` competing against ${enrichedDeal.competitor}`
      : "";

    return {
      content: [{
        type: "text" as const,
        text: `**Enablement Package Preview**\n` +
          `_${enrichedDeal.industry} deal at ${enrichedDeal.deal_stage}${competitorNote}_\n\n` +
          `---\n\n${content}\n\n---\n\n` +
          `This is what a rep would receive when this deal moves stage. ` +
          `To deliver this automatically, connect your CRM webhook to the server.\n\n` +
          `To refine: update your case studies, objections, or competitor positioning and generate again.`,
      }],
    };
  }
);

// ── Tool: list_entries ──────────────────────────────────────

server.tool(
  "list_entries",
  "List all entries in the knowledge base — case studies, competitor positioning, and methodology.",
  {
    type: z.enum(["all", "case_studies", "competitors", "objections", "methodology"]).default("all").describe("What to list"),
  },
  async ({ type }) => {
    const kb = readKB(config.kbPath);
    const parts: string[] = [];

    if (type === "all" || type === "case_studies") {
      if (kb.case_studies.length === 0) {
        parts.push("**Case Studies:** None added yet.");
      } else {
        parts.push(`**Case Studies (${kb.case_studies.length}):**`);
        for (const cs of kb.case_studies) {
          let line = `  - [${cs.id}] ${cs.company} (${cs.industry}, ${cs.segment}) — ${cs.metric}`;
          if (cs.resources && cs.resources.length > 0) {
            line += `\n    Resources: ${cs.resources.map((r) => `${r.label} (${r.url})`).join(", ")}`;
          }
          parts.push(line);
        }
      }
    }

    if (type === "all" || type === "competitors") {
      if (kb.competitor_positioning.length === 0) {
        parts.push("\n**Competitor Positioning:** None added yet.");
      } else {
        parts.push(`\n**Competitor Positioning (${kb.competitor_positioning.length}):**`);
        for (const cp of kb.competitor_positioning) {
          let line = `  - [${cp.id}] vs. ${cp.competitor} (${cp.category}): ${cp.differentiator}`;
          if (cp.resources && cp.resources.length > 0) {
            line += `\n    Resources: ${cp.resources.map((r) => `${r.label} (${r.url})`).join(", ")}`;
          }
          parts.push(line);
        }
      }
    }

    if (type === "all" || type === "objections") {
      if (kb.objection_library.length === 0) {
        parts.push("\n**Objection Library:** None added yet.");
      } else {
        parts.push(`\n**Objection Library (${kb.objection_library.length}):**`);
        for (const ob of kb.objection_library) {
          const competitorTag = ob.competitor ? ` | vs. ${ob.competitor}` : "";
          parts.push(`  - [${ob.id}] (${ob.category}${competitorTag}) "${ob.objection}"`);
          parts.push(`    → ${ob.response}`);
        }
      }
    }

    if (type === "all" || type === "methodology") {
      if (!kb.methodology) {
        parts.push("\n**Sales Methodology:** Not configured.");
      } else {
        parts.push(`\n**Sales Methodology:** ${kb.methodology.name}`);
        parts.push(`  ${kb.methodology.description}`);
        for (const [stage, guidance] of Object.entries(kb.methodology.stage_guidance)) {
          parts.push(`  - ${stage}: ${guidance}`);
        }
      }
    }

    parts.push(`\n**Status:** ${kb._meta.configured ? "Configured" : "Not configured"} | ${kb._meta.entry_count} total entries | Last updated: ${kb._meta.last_updated || "Never"}`);

    return { content: [{ type: "text" as const, text: parts.join("\n") }] };
  }
);

// ── Tool: search_entries ────────────────────────────────────

server.tool(
  "search_entries",
  "Search the knowledge base by industry, competitor, or deal stage.",
  {
    industry: z.string().optional().describe("Filter by industry (partial match)"),
    competitor: z.string().optional().describe("Filter by competitor name (partial match)"),
    stage: z.string().optional().describe("Filter by deal stage relevance"),
  },
  async ({ industry, competitor, stage }) => {
    const kb = readKB(config.kbPath);
    const parts: string[] = [];

    let matchedCS = kb.case_studies;
    if (industry) {
      matchedCS = matchedCS.filter((cs) => cs.industry.toLowerCase().includes(industry.toLowerCase()));
    }
    if (stage) {
      matchedCS = matchedCS.filter((cs) => cs.relevant_stages.some((s) => s.toLowerCase().includes(stage.toLowerCase())));
    }

    if (matchedCS.length === 0) {
      parts.push("**Case Studies:** No matches found.");
    } else {
      parts.push(`**Matching Case Studies (${matchedCS.length}):**`);
      for (const cs of matchedCS) {
        parts.push(`  - [${cs.id}] ${cs.company} (${cs.industry}) — ${cs.metric}\n    Challenge: ${cs.challenge}\n    Result: ${cs.result}`);
      }
    }

    if (competitor) {
      const matchedCP = kb.competitor_positioning.filter((cp) => cp.competitor.toLowerCase().includes(competitor.toLowerCase()));
      if (matchedCP.length === 0) {
        parts.push(`\n**Competitor Positioning vs. "${competitor}":** No matches found.`);
      } else {
        parts.push(`\n**Positioning vs. "${competitor}" (${matchedCP.length}):**`);
        for (const cp of matchedCP) {
          parts.push(`  - ${cp.differentiator}`);
          if (cp.supporting_evidence) parts.push(`    Evidence: ${cp.supporting_evidence}`);
          if (cp.resources && cp.resources.length > 0) parts.push(`    Resources: ${cp.resources.map((r) => `${r.label} (${r.url})`).join(", ")}`);
        }
      }
    }

    // Search objections
    let matchedOB = kb.objection_library;
    if (competitor) {
      matchedOB = matchedOB.filter((ob) => ob.competitor.toLowerCase().includes(competitor.toLowerCase()));
    }
    if (stage) {
      matchedOB = matchedOB.filter((ob) => ob.relevant_stages.some((s) => s.toLowerCase().includes(stage.toLowerCase())));
    }
    if (matchedOB.length > 0) {
      parts.push(`\n**Matching Objections (${matchedOB.length}):**`);
      for (const ob of matchedOB) {
        parts.push(`  - [${ob.id}] "${ob.objection}"\n    → ${ob.response}`);
      }
    }

    return { content: [{ type: "text" as const, text: parts.join("\n") }] };
  }
);

// ── Tool: remove_entry ──────────────────────────────────────

server.tool(
  "remove_entry",
  "Remove an entry from the knowledge base by its ID (e.g., 'cs-001') or by name match.",
  {
    id: z.string().optional().describe("Entry ID to remove (e.g., 'cs-001', 'cp-002')"),
    name: z.string().optional().describe("Company or competitor name to match (removes first match)"),
  },
  async ({ id, name }) => {
    const kb = readKB(config.kbPath);
    let removed = false;
    let removedDesc = "";

    if (id) {
      const csIdx = kb.case_studies.findIndex((cs) => cs.id === id);
      if (csIdx >= 0) {
        removedDesc = `case study "${kb.case_studies[csIdx].company}"`;
        kb.case_studies.splice(csIdx, 1);
        removed = true;
      }
      const cpIdx = kb.competitor_positioning.findIndex((cp) => cp.id === id);
      if (cpIdx >= 0) {
        removedDesc = `competitor positioning vs. "${kb.competitor_positioning[cpIdx].competitor}"`;
        kb.competitor_positioning.splice(cpIdx, 1);
        removed = true;
      }
      const obIdx = kb.objection_library.findIndex((ob) => ob.id === id);
      if (obIdx >= 0) {
        removedDesc = `objection "${kb.objection_library[obIdx].objection.slice(0, 50)}..."`;
        kb.objection_library.splice(obIdx, 1);
        removed = true;
      }
    } else if (name) {
      const csIdx = kb.case_studies.findIndex((cs) => cs.company.toLowerCase().includes(name.toLowerCase()));
      if (csIdx >= 0) {
        removedDesc = `case study "${kb.case_studies[csIdx].company}"`;
        kb.case_studies.splice(csIdx, 1);
        removed = true;
      }
      if (!removed) {
        const cpIdx = kb.competitor_positioning.findIndex((cp) => cp.competitor.toLowerCase().includes(name.toLowerCase()));
        if (cpIdx >= 0) {
          removedDesc = `competitor positioning vs. "${kb.competitor_positioning[cpIdx].competitor}"`;
          kb.competitor_positioning.splice(cpIdx, 1);
          removed = true;
        }
      }
      if (!removed) {
        const obIdx = kb.objection_library.findIndex((ob) => ob.objection.toLowerCase().includes(name.toLowerCase()) || ob.category.toLowerCase().includes(name.toLowerCase()));
        if (obIdx >= 0) {
          removedDesc = `objection "${kb.objection_library[obIdx].objection.slice(0, 50)}..."`;
          kb.objection_library.splice(obIdx, 1);
          removed = true;
        }
      }
    }

    if (removed) {
      writeKB(config.kbPath, kb);
      return { content: [{ type: "text" as const, text: `Removed ${removedDesc}.\n\nKnowledge base now has ${kb._meta.entry_count} entries.` }] };
    }
    return { content: [{ type: "text" as const, text: `No entry found matching ${id ? `ID "${id}"` : `name "${name}"`}. Use list_entries to see all entries.` }] };
  }
);

// ── Tool: get_status ────────────────────────────────────────

server.tool(
  "get_status",
  "Check the current status of the knowledge base — is it configured, how many entries, when was it last updated?",
  async () => {
    const kb = readKB(config.kbPath);
    const lines = [
      `**Knowledge Base Status**`,
      `- Configured: ${kb._meta.configured ? "Yes" : "No"}`,
      `- Case Studies: ${kb.case_studies.length}`,
      `- Competitor Positions: ${kb.competitor_positioning.length}`,
      `- Objection Library: ${kb.objection_library.length}`,
      `- Methodology: ${kb.methodology ? kb.methodology.name : "Not set"}`,
      `- Total Entries: ${kb._meta.entry_count}`,
      `- Last Updated: ${kb._meta.last_updated || "Never"}`,
      `- File: ${config.kbPath}`,
      "",
      kb._meta.configured
        ? "The webhook server will use this content for enablement packages."
        : "The webhook server is currently BLOCKED — it will not send any output until you add at least one case study.",
    ];
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool: upload_document ───────────────────────────────────

server.tool(
  "upload_document",
  "Process text content from a document (battle card, case study PDF, etc.) and extract structured entries. Pass the document text and Claude will extract case studies and competitor positioning.",
  {
    content: z.string().describe("The text content of the document to process"),
    document_type: z.enum(["battle_card", "case_study", "general"]).default("general").describe("Type of document"),
    source_name: z.string().default("uploaded document").describe("Name or filename of the source document"),
  },
  async ({ content, document_type, source_name }) => {
    return {
      content: [{
        type: "text" as const,
        text: `Document received: "${source_name}" (${document_type}, ${content.length} characters).\n\nHere is the document content for extraction:\n\n---\n${content}\n---\n\nPlease extract any case studies and competitor positioning from this document, then use the add_case_study and add_competitor tools to add them to the knowledge base.`,
      }],
    };
  }
);

// ── Tool: get_feedback_summary ──────────────────────────────

server.tool(
  "get_feedback_summary",
  "Get a summary of how your enablement content is performing. Shows delivery count, reaction breakdown, field signals received, and which content gets the most positive/negative reactions.",
  {
    days: z.number().default(30).describe("Number of days to look back (default: 30)"),
  },
  async ({ days }) => {
    const log = readFeedbackLog(config.feedbackLogPath);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const recentDeliveries = log.deliveries.filter((d) => d.timestamp >= cutoff);
    const recentFeedback = log.feedback.filter((f) => f.timestamp >= cutoff);

    const reactions = recentFeedback.filter((f) => f.source === "reaction");
    const helpful = reactions.filter((f) => f.value === "helpful");
    const notHelpful = reactions.filter((f) => f.value === "not_helpful");
    const fieldSignals = recentFeedback.filter((f) => f.source === "reply" || f.source === "call_intel");
    const outcomes = recentFeedback.filter((f) => f.source === "outcome");
    const won = outcomes.filter((f) => f.value === "closed_won");
    const lost = outcomes.filter((f) => f.value === "closed_lost");

    const csSurfaceCount: Record<string, { count: number; helpfulCount: number; notHelpfulCount: number }> = {};
    for (const delivery of recentDeliveries) {
      for (const csId of delivery.case_studies_surfaced) {
        if (!csSurfaceCount[csId]) csSurfaceCount[csId] = { count: 0, helpfulCount: 0, notHelpfulCount: 0 };
        csSurfaceCount[csId].count++;
      }
    }
    for (const fb of reactions) {
      const delivery = recentDeliveries.find((d) => d.delivery_id === fb.delivery_id);
      if (delivery) {
        for (const csId of delivery.case_studies_surfaced) {
          if (csSurfaceCount[csId]) {
            if (fb.value === "helpful") csSurfaceCount[csId].helpfulCount++;
            if (fb.value === "not_helpful") csSurfaceCount[csId].notHelpfulCount++;
          }
        }
      }
    }

    const helpfulRate = reactions.length > 0 ? Math.round((helpful.length / reactions.length) * 100) : 0;

    const lines: string[] = [
      `\ud83d\udcca **Feedback Summary** (last ${days} days)`,
      `- ${recentDeliveries.length} enablement deliveries sent`,
      `- ${reactions.length} reactions received: ${helpful.length} helpful (${helpfulRate}%), ${notHelpful.length} not helpful`,
      `- ${fieldSignals.length} field signals from reps`,
      `- ${outcomes.length} outcomes tracked: ${won.length} closed won, ${lost.length} closed lost`,
    ];

    const sortedCS = Object.entries(csSurfaceCount).sort(([, a], [, b]) => b.count - a.count);
    if (sortedCS.length > 0) {
      lines.push("", "**Top surfaced content:**");
      for (const [csId, data] of sortedCS.slice(0, 5)) {
        lines.push(`- ${csId}: surfaced ${data.count} times, ${data.helpfulCount} helpful, ${data.notHelpfulCount} not helpful`);
      }
    }

    const needsReview = sortedCS.filter(([, data]) => data.notHelpfulCount > 0);
    if (needsReview.length > 0) {
      lines.push("", "\u26a0\ufe0f **Content to review:**");
      for (const [csId, data] of needsReview) {
        lines.push(`- ${csId}: ${data.notHelpfulCount} not-helpful reaction(s) — may need updating`);
      }
    }

    if (recentDeliveries.length === 0 && recentFeedback.length === 0) {
      lines.push("", "No delivery or feedback data yet. Once the webhook server starts delivering enablement packages and reps react, data will appear here.");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool: get_outcomes ──────────────────────────────────────

server.tool(
  "get_outcomes",
  "See which enabled deals have closed (won or lost) and what content was surfaced for each.",
  {
    outcome: z.enum(["all", "won", "lost"]).default("all").describe("Filter outcomes"),
  },
  async ({ outcome }) => {
    const log = readFeedbackLog(config.feedbackLogPath);
    let outcomeFeedback = log.feedback.filter((f) => f.source === "outcome");
    if (outcome === "won") outcomeFeedback = outcomeFeedback.filter((f) => f.value === "closed_won");
    else if (outcome === "lost") outcomeFeedback = outcomeFeedback.filter((f) => f.value === "closed_lost");

    if (outcomeFeedback.length === 0) {
      return { content: [{ type: "text" as const, text: `No ${outcome === "all" ? "" : outcome + " "}outcome data yet.` }] };
    }

    const lines: string[] = [`\ud83c\udfaf **Deal Outcomes** (${outcomeFeedback.length} total)`, ""];
    for (const fb of outcomeFeedback) {
      const delivery = log.deliveries.find((d) => d.delivery_id === fb.delivery_id);
      const emoji = fb.value === "closed_won" ? "\ud83c\udf89" : "\ud83d\udcc9";
      const outcomeLabel = fb.value === "closed_won" ? "Won" : "Lost";

      lines.push(`${emoji} **${fb.deal_name || "Unknown Deal"}** \u2014 ${outcomeLabel}`);
      if (delivery) {
        lines.push(`  - Enablement delivered at: ${delivery.deal_stage} (${delivery.timestamp})`);
        if (delivery.case_studies_surfaced.length > 0) lines.push(`  - Case studies used: ${delivery.case_studies_surfaced.join(", ")}`);
        if (delivery.competitors_surfaced.length > 0) lines.push(`  - Competitor positioning used: ${delivery.competitors_surfaced.join(", ")}`);
      }
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool: get_field_signals ─────────────────────────────────

server.tool(
  "get_field_signals",
  "See what reps are telling you from the field — thread replies with new objections, call intel, and field observations.",
  {
    days: z.number().default(30).describe("Number of days to look back (default: 30)"),
  },
  async ({ days }) => {
    const log = readFeedbackLog(config.feedbackLogPath);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const signals = log.feedback.filter((f) => (f.source === "reply" || f.source === "call_intel") && f.timestamp >= cutoff);

    if (signals.length === 0) {
      return { content: [{ type: "text" as const, text: `No field signals in the last ${days} days.` }] };
    }

    const lines: string[] = [`\ud83d\udcac **Field Signals** (last ${days} days, ${signals.length} total)`, ""];
    for (const signal of signals) {
      const emoji = signal.source === "call_intel" ? "\ud83d\udcde" : "\ud83d\udcac";
      const sourceLabel = signal.source === "call_intel" ? "Call intel" : "Rep reply";
      const delivery = log.deliveries.find((d) => d.delivery_id === signal.delivery_id);

      lines.push(`${emoji} **${sourceLabel}**`);
      if (signal.deal_name) lines.push(`  Deal: ${signal.deal_name}`);
      else if (delivery) lines.push(`  Deal: ${delivery.deal_name} (${delivery.deal_stage}, ${delivery.industry})`);
      lines.push(`  "${signal.raw_text || signal.value}"`, `  \u2014 ${signal.rep_id || "Unknown rep"}, ${signal.timestamp}`, "");
    }

    lines.push("---", "Review these signals and update your knowledge base if any objections or competitive intel are not currently covered.");
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool: add_rep ─────────────────────────────────────────

server.tool(
  "add_rep",
  "Add or update a sales rep in the directory. Maps their email (from CRM) to their Slack user ID so enablement messages reach the right person via DM.",
  {
    email: z.string().describe("Rep's email address (must match what's in the CRM)"),
    name: z.string().describe("Rep's display name"),
    slack_id: z.string().default("").describe("Slack user ID (e.g., 'U01ABC123'). Find it in Slack: click their profile → More → Copy member ID."),
    telegram_chat_id: z.string().default("").describe("Telegram chat ID (optional, for Telegram channel users)"),
  },
  async ({ email, name, slack_id, telegram_chat_id }) => {
    upsertRep(config.repDirectoryPath, {
      email,
      name,
      slack_id,
      telegram_chat_id,
      registered_at: new Date().toISOString(),
      registered_via: "manual",
    });

    const dir = readRepDirectory(config.repDirectoryPath);
    const routing = slack_id
      ? `Slack DMs → ${slack_id}`
      : telegram_chat_id
        ? `Telegram → ${telegram_chat_id}`
        : "No messaging ID yet — will try Slack API lookup by email";

    return {
      content: [{
        type: "text" as const,
        text: `✓ Rep "${name}" (${email}) added to directory.\nRouting: ${routing}\n\nTeam size: ${dir._meta.total_reps} rep(s) registered.`,
      }],
    };
  }
);

// ── Tool: list_reps ───────────────────────────────────────

server.tool(
  "list_reps",
  "List all sales reps in the directory with their messaging IDs.",
  async () => {
    const dir = readRepDirectory(config.repDirectoryPath);

    if (dir.reps.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "**Rep Directory:** Empty — no reps registered yet.\n\nUse add_rep to register reps so enablement messages can reach them. You'll need their email (must match CRM) and Slack user ID.",
        }],
      };
    }

    const lines = [`**Rep Directory** (${dir.reps.length} reps)`, ""];
    for (const rep of dir.reps) {
      const slackStatus = rep.slack_id ? `Slack: ${rep.slack_id}` : "No Slack ID";
      const telegramStatus = rep.telegram_chat_id ? `Telegram: ${rep.telegram_chat_id}` : "";
      const routing = [slackStatus, telegramStatus].filter(Boolean).join(" | ");
      lines.push(`- **${rep.name}** (${rep.email}) — ${routing}`);
      lines.push(`  Added: ${rep.registered_at} via ${rep.registered_via}`);
    }

    lines.push("", `Last updated: ${dir._meta.last_updated || "Never"}`);
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ── Tool: remove_rep ──────────────────────────────────────

server.tool(
  "remove_rep",
  "Remove a sales rep from the directory by email.",
  {
    email: z.string().describe("Rep's email address to remove"),
  },
  async ({ email }) => {
    const removed = removeRep(config.repDirectoryPath, email);
    if (removed) {
      const dir = readRepDirectory(config.repDirectoryPath);
      return {
        content: [{
          type: "text" as const,
          text: `✓ Removed rep "${email}" from directory.\n\nTeam size: ${dir._meta.total_reps} rep(s) remaining.`,
        }],
      };
    }
    return {
      content: [{
        type: "text" as const,
        text: `No rep found with email "${email}". Use list_reps to see all registered reps.`,
      }],
    };
  }
);

// ── Start ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
