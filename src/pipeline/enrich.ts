/**
 * Deal enrichment — already handled by parseCrmPayload() in parse.ts.
 *
 * In the n8n workflow, enrichment was a separate node because each
 * node could only access its own input. In our pipeline, parse.ts
 * already extracts all fields (industry, competitor, deal_size, etc.)
 * in one pass.
 *
 * This module exists for two purposes:
 * 1. Post-parse enrichment (e.g., industry normalization, defaults)
 * 2. Maintaining the pipeline's logical step order for readability
 */

import type { DealContext } from "../shared/types.js";

/**
 * Enrich a parsed deal context with normalized values and defaults.
 *
 * Applies business logic that sits above raw CRM field mapping:
 * - Normalizes empty strings to meaningful defaults
 * - Could later add lookup enrichment (e.g., industry from company name)
 */
export function enrichDealContext(deal: DealContext): DealContext {
  return {
    ...deal,
    industry: deal.industry || "Technology",
    competitor: deal.competitor || "Not specified",
    deal_size: deal.deal_size || 0,
  };
}
