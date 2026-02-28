/**
 * Context gate — blocks the pipeline if the knowledge base
 * is not configured or has no case studies.
 *
 * This prevents reps from receiving fabricated content.
 * Claude can only generate enablement packages from REAL KB entries.
 */

import type { KnowledgeBase } from "../shared/types.js";

/**
 * Check if the knowledge base is ready for enablement delivery.
 *
 * @returns true if pipeline should proceed, false to block
 */
export function contextGate(kb: KnowledgeBase): boolean {
  const isConfigured = kb._meta?.configured === true;
  const hasCaseStudies = kb.case_studies?.length > 0;

  return isConfigured && hasCaseStudies;
}
