/**
 * Stage filter — determines which deal stage changes should trigger
 * the enablement pipeline or outcome tracking.
 */

const ENABLEMENT_STAGES = ["Proposal Sent", "Negotiation"];
const OUTCOME_STAGES = ["Closed Won", "Closed Lost"];

export type StageType = "enablement" | "outcome" | "skip";

/**
 * Classify a deal stage as enablement-worthy, outcome-worthy, or skip.
 *
 * @param stage - The deal stage string from the CRM
 * @returns "enablement" if rep needs content, "outcome" if deal closed, "skip" otherwise
 */
export function classifyStage(stage: string): StageType {
  if (ENABLEMENT_STAGES.includes(stage)) return "enablement";
  if (OUTCOME_STAGES.includes(stage)) return "outcome";
  return "skip";
}

/**
 * Check if a stage matches any of the provided target stages.
 * Used for custom stage configurations.
 */
export function filterStage(
  stage: string,
  targetStages: string[]
): boolean {
  return targetStages.includes(stage);
}

/**
 * Extract the deal stage from a raw CRM webhook payload.
 * Handles the various field names across CRM platforms.
 */
export function extractStage(raw: Record<string, unknown>): string {
  // n8n-style body wrapping
  const body = (raw.body as Record<string, unknown>) || raw;

  // HubSpot: properties.dealstage
  if (body.properties && typeof body.properties === "object") {
    const props = body.properties as Record<string, unknown>;
    if (props.dealstage) return String(props.dealstage);
  }

  // Salesforce: StageName
  if (body.StageName) return String(body.StageName);

  // Attio: attributes.stage
  if (body.attributes && typeof body.attributes === "object") {
    const attrs = body.attributes as Record<string, unknown>;
    if (attrs.stage) return String(attrs.stage);
  }

  // Pipedrive: current.stage_id or current.stage_name
  if (body.current && typeof body.current === "object") {
    const current = body.current as Record<string, unknown>;
    if (current.stage_name) return String(current.stage_name);
    if (current.stage_id) return String(current.stage_id);
  }

  // Close: status_label
  if (body.status_label) return String(body.status_label);

  // Generic: deal_stage
  if (body.deal_stage) return String(body.deal_stage);

  return "";
}
