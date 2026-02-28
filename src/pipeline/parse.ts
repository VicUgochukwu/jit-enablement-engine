/**
 * CRM payload parser — normalizes webhook payloads from HubSpot,
 * Salesforce, Attio, Pipedrive, Close, and generic formats into
 * a universal DealContext.
 *
 * Detection logic: check for unique field shapes to identify the CRM.
 */

import type { CrmType, DealContext } from "../shared/types.js";

/**
 * Detect CRM type from the payload shape.
 */
function detectCrmType(raw: Record<string, unknown>): CrmType {
  if (raw.properties && typeof raw.properties === "object") return "hubspot";
  if (raw.StageName || raw.Name) return "salesforce";
  if (raw.attributes && typeof raw.attributes === "object") return "attio";
  if (raw.current && typeof raw.current === "object") return "pipedrive";
  if (raw.lead || raw.status_label) return "close";
  return "generic";
}

/**
 * Parse a raw CRM webhook payload into a normalized DealContext.
 *
 * Handles webhook body wrapping (n8n sends {body: {...}}).
 * Each CRM branch maps its specific field names to universal fields.
 */
export function parseCrmPayload(
  rawInput: Record<string, unknown>
): DealContext {
  // Unwrap webhook body wrapper if present
  const raw = (rawInput.body as Record<string, unknown>) || rawInput;
  const crmType = detectCrmType(raw);

  const base: DealContext = {
    deal_name: "Unknown Deal",
    deal_stage: "",
    company_name: "Unknown Company",
    deal_notes: "",
    product_interest: "",
    industry: "Technology",
    competitor: "Not specified",
    deal_size: 0,
    rep_email: "",
    rep_slack_id: "",
    _identity_resolved: false,
    _resolution_method: "unresolved",
    _crm_type: crmType,
    _raw: raw,
  };

  switch (crmType) {
    case "hubspot":
      return parseHubSpot(raw, base);
    case "salesforce":
      return parseSalesforce(raw, base);
    case "attio":
      return parseAttio(raw, base);
    case "pipedrive":
      return parsePipedrive(raw, base);
    case "close":
      return parseClose(raw, base);
    default:
      return parseGeneric(raw, base);
  }
}

// ── HubSpot ────────────────────────────────────────────────

function parseHubSpot(
  raw: Record<string, unknown>,
  base: DealContext
): DealContext {
  const props = (raw.properties || {}) as Record<string, unknown>;

  return {
    ...base,
    deal_name: str(props.dealname, "Unknown Deal"),
    deal_stage: str(props.dealstage, ""),
    company_name: str(props.company, "Unknown Company"),
    deal_notes: str(props.notes, ""),
    product_interest: str(props.product_interest, ""),
    industry: str(props.industry, "Technology"),
    competitor: str(props.competitor || props.hs_competitor, "Not specified"),
    deal_size: num(props.amount),
    rep_email: str(props.hubspot_owner_email, ""),
    rep_slack_id: str(props.rep_slack_id, ""),
  };
}

// ── Salesforce ─────────────────────────────────────────────

function parseSalesforce(
  raw: Record<string, unknown>,
  base: DealContext
): DealContext {
  const account = (raw.Account || {}) as Record<string, unknown>;
  const owner = (raw.Owner || {}) as Record<string, unknown>;

  return {
    ...base,
    deal_name: str(raw.Name, "Unknown Deal"),
    deal_stage: str(raw.StageName, ""),
    company_name: str(account.Name, "Unknown Company"),
    deal_notes: str(raw.Description, ""),
    product_interest: str(raw.Product_Interest__c, ""),
    industry: str(raw.Industry__c, "Technology"),
    competitor: str(raw.Competitor__c, "Not specified"),
    deal_size: num(raw.Amount),
    rep_email: str(owner.Email, ""),
    rep_slack_id: str(raw.Rep_Slack_ID__c, ""),
  };
}

// ── Attio ──────────────────────────────────────────────────

function parseAttio(
  raw: Record<string, unknown>,
  base: DealContext
): DealContext {
  const attrs = (raw.attributes || {}) as Record<string, unknown>;

  return {
    ...base,
    deal_name: str(attrs.name || attrs.title, "Unknown Deal"),
    deal_stage: str(attrs.stage || attrs.status, ""),
    company_name: str(attrs.company, "Unknown Company"),
    deal_notes: str(attrs.notes || attrs.description, ""),
    product_interest: str(attrs.product_interest, ""),
    industry: str(attrs.industry, "Technology"),
    competitor: str(attrs.competitor, "Not specified"),
    deal_size: num(attrs.value || attrs.amount),
    rep_email: str(attrs.owner_email, ""),
    rep_slack_id: str(attrs.rep_slack_id, ""),
  };
}

// ── Pipedrive ──────────────────────────────────────────────

function parsePipedrive(
  raw: Record<string, unknown>,
  base: DealContext
): DealContext {
  const current = (raw.current || {}) as Record<string, unknown>;

  return {
    ...base,
    deal_name: str(current.title, "Unknown Deal"),
    deal_stage: str(current.stage_name || current.status, ""),
    company_name: str(current.org_name, "Unknown Company"),
    deal_notes: str(current.notes, ""),
    product_interest: str(current.product_interest, ""),
    industry: str(current.industry, "Technology"),
    competitor: str(current.competitor, "Not specified"),
    deal_size: num(current.value),
    rep_email: str(current.owner_email, ""),
    rep_slack_id: str(current.rep_slack_id, ""),
  };
}

// ── Close ──────────────────────────────────────────────────

function parseClose(
  raw: Record<string, unknown>,
  base: DealContext
): DealContext {
  const lead = (raw.lead || {}) as Record<string, unknown>;

  return {
    ...base,
    deal_name: str(lead.display_name || raw.lead_name, "Unknown Deal"),
    deal_stage: str(raw.status_label || raw.status_type, ""),
    company_name: str(lead.name || lead.display_name, "Unknown Company"),
    deal_notes: str(raw.note, ""),
    product_interest: str(raw.product_interest, ""),
    industry: str(raw.industry, "Technology"),
    competitor: str(raw.competitor, "Not specified"),
    deal_size: num(raw.value || raw.annualized_value),
    rep_email: str(raw.user_email, ""),
    rep_slack_id: str(raw.rep_slack_id, ""),
  };
}

// ── Generic ────────────────────────────────────────────────

function parseGeneric(
  raw: Record<string, unknown>,
  base: DealContext
): DealContext {
  return {
    ...base,
    deal_name: str(raw.deal_name, "Unknown Deal"),
    deal_stage: str(raw.deal_stage, ""),
    company_name: str(raw.company_name, "Unknown Company"),
    deal_notes: str(raw.deal_notes, ""),
    product_interest: str(raw.product_interest, ""),
    industry: str(raw.industry, "Technology"),
    competitor: str(raw.competitor, "Not specified"),
    deal_size: num(raw.deal_size),
    rep_email: str(raw.rep_email, ""),
    rep_slack_id: str(raw.rep_slack_id, ""),
  };
}

// ── Helpers ────────────────────────────────────────────────

function str(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  return fallback;
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
