/**
 * JIT Sales Enablement Engine — Shared Types
 *
 * All interfaces used across the MCP server, webhook server,
 * and pipeline modules. Single source of truth.
 */

// ============================================================
// KNOWLEDGE BASE
// ============================================================

export interface ResourceLink {
  label: string;
  url: string;
}

export interface CaseStudy {
  id: string;
  company: string;
  industry: string;
  segment: string;
  challenge: string;
  result: string;
  metric: string;
  relevant_stages: string[];
  resources: ResourceLink[];
}

export interface CompetitorPositioning {
  id: string;
  competitor: string;
  differentiator: string;
  category: string;
  supporting_evidence: string;
  resources: ResourceLink[];
}

export interface ObjectionEntry {
  id: string;
  objection: string;
  response: string;
  competitor: string;
  category: string;
  relevant_stages: string[];
}

export interface Methodology {
  name: string;
  description: string;
  stage_guidance: Record<string, string>;
}

export interface KnowledgeBaseMeta {
  last_updated: string | null;
  version: string;
  entry_count: number;
  configured: boolean;
}

export interface KnowledgeBase {
  case_studies: CaseStudy[];
  competitor_positioning: CompetitorPositioning[];
  objection_library: ObjectionEntry[];
  methodology: Methodology | null;
  _meta: KnowledgeBaseMeta;
}

// ============================================================
// FEEDBACK LOG
// ============================================================

export interface DeliveryEntry {
  delivery_id: string;
  deal_name: string;
  deal_stage: string;
  industry: string;
  competitor: string;
  rep_id: string;
  case_studies_surfaced: string[];
  competitors_surfaced: string[];
  channel: string;
  timestamp: string;
}

export type FeedbackSource = "reaction" | "reply" | "outcome" | "call_intel";

export interface FeedbackEntry {
  id: string;
  delivery_id: string;
  source: FeedbackSource;
  value: string;
  raw_text: string | null;
  rep_id: string;
  deal_name: string;
  timestamp: string;
}

export interface FeedbackLogMeta {
  last_updated: string | null;
  version: string;
  total_deliveries: number;
  total_feedback: number;
}

export interface FeedbackLog {
  deliveries: DeliveryEntry[];
  feedback: FeedbackEntry[];
  _meta: FeedbackLogMeta;
}

// ============================================================
// PIPELINE — Deal Context (normalized from any CRM)
// ============================================================

export type CrmType =
  | "hubspot"
  | "salesforce"
  | "attio"
  | "pipedrive"
  | "close"
  | "generic";

export interface DealContext {
  deal_name: string;
  deal_stage: string;
  company_name: string;
  deal_notes: string;
  product_interest: string;
  industry: string;
  competitor: string;
  deal_size: number;
  rep_email: string;
  rep_slack_id: string;
  _identity_resolved: boolean;
  _resolution_method: string;
  _crm_type: CrmType;
  _raw: Record<string, unknown>;
}

// ============================================================
// PIPELINE — Results
// ============================================================

export interface PipelineResult {
  success: boolean;
  delivery_id: string | null;
  deal_name: string;
  deal_stage: string;
  channel: string;
  error?: string;
}

// ============================================================
// MESSAGING — Slack Block Kit
// ============================================================

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<Record<string, unknown>>;
}

export interface SlackMessage {
  channel: string;
  blocks: SlackBlock[];
  text: string; // Fallback for notifications
  delivery_id: string;
  deal_name: string;
  deal_stage: string;
  company_name: string;
  industry: string;
  competitor: string;
  case_studies_surfaced: string[];
  competitors_surfaced: string[];
}

// ============================================================
// MESSAGING — Telegram
// ============================================================

export interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode: "HTML";
  reply_markup: {
    inline_keyboard: Array<
      Array<{ text: string; callback_data: string }>
    >;
  };
  delivery_id: string;
  deal_name: string;
  deal_stage: string;
}

// ============================================================
// REP DIRECTORY — maps rep identifiers to messaging platform IDs
// ============================================================

export interface RepEntry {
  email: string; // Primary key — from CRM deal owner
  name: string;
  slack_id: string; // Slack user ID (e.g., "U01ABC123")
  telegram_chat_id: string; // Telegram chat ID (e.g., "532751028")
  registered_at: string; // ISO timestamp
  registered_via: "manual" | "bot_start"; // How they were added
}

export interface RepDirectory {
  reps: RepEntry[];
  _meta: {
    last_updated: string | null;
    version: string;
    total_reps: number;
  };
}

// ============================================================
// PMM Notification
// ============================================================

export interface PmmNotification {
  text: string;
  deal_name: string;
  type: "outcome" | "field_signal" | "reaction_summary";
}
