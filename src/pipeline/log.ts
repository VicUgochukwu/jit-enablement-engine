/**
 * Delivery logger — records each enablement delivery to the
 * local feedback log for correlation and tracking.
 *
 * Replaces the n8n "Log Delivery" node and GitHub API write cycle.
 * Now just a local file append.
 */

import type { DeliveryEntry, DealContext, KnowledgeBase } from "../shared/types.js";
import { appendDelivery } from "../shared/data.js";
import { generateDeliveryId } from "../shared/id.js";

/**
 * Build a delivery entry from deal context and KB state.
 */
export function buildDeliveryEntry(
  deal: DealContext,
  kb: KnowledgeBase,
  deliveryId: string,
  channel: string
): DeliveryEntry {
  const caseStudiesSurfaced = (kb.case_studies || []).map((cs) => cs.id);
  const competitorsSurfaced = (kb.competitor_positioning || [])
    .filter((cp) => cp.competitor === deal.competitor)
    .map((cp) => cp.id);

  return {
    delivery_id: deliveryId,
    deal_name: deal.deal_name,
    deal_stage: deal.deal_stage,
    industry: deal.industry,
    competitor: deal.competitor,
    rep_id: deal.rep_slack_id || deal.rep_email || "unknown",
    case_studies_surfaced: caseStudiesSurfaced,
    competitors_surfaced: competitorsSurfaced,
    channel,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log a delivery to the local feedback log.
 */
export function logDelivery(
  deal: DealContext,
  kb: KnowledgeBase,
  deliveryId: string,
  channel: string,
  feedbackLogPath: string
): DeliveryEntry {
  const entry = buildDeliveryEntry(deal, kb, deliveryId, channel);
  appendDelivery(feedbackLogPath, entry);
  console.log(
    `[JIT] Delivered: ${deal.deal_name} (${deal.deal_stage}) → ${deal.rep_slack_id || deal.rep_email} [${deliveryId}]`
  );
  return entry;
}
