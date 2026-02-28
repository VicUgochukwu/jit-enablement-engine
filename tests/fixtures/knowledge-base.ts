/**
 * Test fixtures — knowledge base states.
 */

import type { KnowledgeBase, FeedbackLog } from "../../src/shared/types.js";

export const emptyKB: KnowledgeBase = {
  case_studies: [],
  competitor_positioning: [],
  objection_library: [],
  methodology: null,
  _meta: {
    last_updated: null,
    version: "1.0",
    entry_count: 0,
    configured: false,
  },
};

export const configuredKB: KnowledgeBase = {
  case_studies: [
    {
      id: "cs-001",
      company: "FinServ Corp",
      industry: "Financial Services",
      segment: "Enterprise",
      challenge: "Pipeline velocity stalling at proposal stage with 45-day average cycle",
      result: "45% pipeline velocity increase within 3 months of deployment",
      metric: "45% pipeline velocity increase",
      relevant_stages: ["Proposal Sent", "Negotiation"],
      resources: [
        { label: "One Pager", url: "https://canva.com/design/finserv-one-pager" },
        { label: "Full Case Study", url: "https://notion.so/finserv-case-study" },
      ],
    },
    {
      id: "cs-002",
      company: "HealthFirst",
      industry: "Healthcare",
      segment: "Mid-market",
      challenge: "Manual follow-ups consuming 60% of rep time with no personalization",
      result: "60% reduction in manual follow-ups, $2M ARR expansion in 6 months",
      metric: "60% reduction in manual follow-ups",
      relevant_stages: ["Proposal Sent"],
      resources: [],
    },
  ],
  competitor_positioning: [
    {
      id: "cp-001",
      competitor: "Gong",
      differentiator:
        "We offer real-time coaching during live calls, not just post-call analysis. Reps using our live coaching close 23% more deals.",
      category: "Conversation Intelligence",
      supporting_evidence:
        "Internal benchmark: reps using live coaching close 23% more deals than those using post-call review only.",
      resources: [
        { label: "Battle Card", url: "https://canva.com/design/gong-battlecard" },
      ],
    },
    {
      id: "cp-002",
      competitor: "Outreach",
      differentiator:
        "Our sequences adapt based on buyer signals in real-time, not just time delays.",
      category: "Sales Engagement",
      supporting_evidence: "",
      resources: [],
    },
  ],
  objection_library: [
    {
      id: "ob-001",
      objection: "Your pricing is 30% higher than Gong",
      response: "Our pricing reflects real-time coaching during live calls, not just post-call analysis. Customers using live coaching close 23% more deals — the ROI more than covers the difference within one quarter.",
      competitor: "Gong",
      category: "Pricing",
      relevant_stages: ["Proposal Sent", "Negotiation"],
    },
    {
      id: "ob-002",
      objection: "We already have a conversation intelligence tool",
      response: "Most CI tools analyze calls after the fact. Ours coaches reps in real-time during the call itself. The difference is reps course-correct in the moment instead of learning from mistakes after the deal moves on.",
      competitor: "",
      category: "Switching Cost",
      relevant_stages: ["Proposal Sent"],
    },
  ],
  methodology: {
    name: "MEDDIC",
    description:
      "Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion",
    stage_guidance: {
      "Proposal Sent":
        "Focus on Metrics and Decision Criteria. Quantify the business impact.",
      Negotiation:
        "Focus on Economic Buyer and Champion alignment. Ensure the champion can sell internally.",
    },
  },
  _meta: {
    last_updated: "2026-02-27T10:00:00Z",
    version: "1.0",
    entry_count: 7,
    configured: true,
  },
};

export const emptyFeedbackLog: FeedbackLog = {
  deliveries: [],
  feedback: [],
  _meta: {
    last_updated: null,
    version: "1.0",
    total_deliveries: 0,
    total_feedback: 0,
  },
};

export const populatedFeedbackLog: FeedbackLog = {
  deliveries: [
    {
      delivery_id: "del-test123",
      deal_name: "Acme Corp Enterprise Platform",
      deal_stage: "Proposal Sent",
      industry: "Financial Services",
      competitor: "Gong",
      rep_id: "U12345",
      case_studies_surfaced: ["cs-001"],
      competitors_surfaced: ["cp-001"],
      channel: "slack",
      timestamp: "2026-02-27T10:00:00Z",
    },
  ],
  feedback: [
    {
      id: "fb-001",
      delivery_id: "del-test123",
      source: "reaction",
      value: "helpful",
      raw_text: null,
      rep_id: "U12345",
      deal_name: "Acme Corp Enterprise Platform",
      timestamp: "2026-02-27T10:05:00Z",
    },
  ],
  _meta: {
    last_updated: "2026-02-27T10:05:00Z",
    version: "1.0",
    total_deliveries: 1,
    total_feedback: 1,
  },
};
