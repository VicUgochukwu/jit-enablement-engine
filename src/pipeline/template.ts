/**
 * Template-based enablement formatter — assembles personalized
 * enablement packages directly from KB data WITHOUT calling Claude API.
 *
 * This replaces the Claude API call for users who don't have (or don't
 * want to use) an ANTHROPIC_API_KEY. The intelligence is in the KB
 * content itself, curated by the PMM via Claude Co-work / Claude Code.
 *
 * Matching logic:
 * 1. Case studies — matched by industry (exact), then by stage relevance
 * 2. Competitor positioning — matched by competitor name (exact, case-insensitive)
 * 3. Objections — matched by competitor + deal stage relevance
 * 4. Methodology — stage-specific guidance applied automatically
 *
 * The output is structured, scannable, and ready for Slack/Telegram delivery.
 */

import type { DealContext, KnowledgeBase, CaseStudy, CompetitorPositioning, ObjectionEntry } from "../shared/types.js";

/**
 * Generate an enablement package from KB data using templates.
 * No Claude API call required.
 */
export function buildTemplateEnablement(deal: DealContext, kb: KnowledgeBase): string {
  const sections: string[] = [];

  // ── 1. Relevant objections ──────────────────────────────
  const objections = findRelevantObjections(deal, kb.objection_library || []);
  if (objections.length > 0) {
    sections.push(formatObjectionSection(objections));
  }

  // ── 2. Best-match case study ─────────────────────────────
  const bestCaseStudy = findBestCaseStudy(deal, kb.case_studies);
  if (bestCaseStudy) {
    sections.push(formatCaseStudySection(bestCaseStudy, deal));
  } else {
    sections.push("RELEVANT CASE STUDY\nNo matching case studies for this deal's industry or stage. Consider adding one via Claude Co-work.");
  }

  // ── 3. Competitor positioning ────────────────────────────
  const positioning = findCompetitorPositioning(deal.competitor, kb.competitor_positioning);
  if (positioning) {
    sections.push(formatCompetitorSection(positioning));
  } else if (deal.competitor && deal.competitor !== "Unknown" && deal.competitor !== "None" && deal.competitor !== "Not specified") {
    sections.push(`COMPETITOR POSITIONING\nNo positioning available against ${deal.competitor}. Consider adding one via Claude Co-work.`);
  }

  // ── 4. Methodology guidance ──────────────────────────────
  if (kb.methodology) {
    const methodologySection = formatMethodologySection(kb.methodology, deal.deal_stage);
    if (methodologySection) {
      sections.push(methodologySection);
    }
  }

  // ── 5. Quick context header ──────────────────────────────
  const header = [
    `DEAL CONTEXT`,
    `Company: ${deal.company_name} | Industry: ${deal.industry}`,
    `Stage: ${deal.deal_stage} | Size: $${Number(deal.deal_size).toLocaleString()}`,
    deal.competitor !== "Unknown" && deal.competitor !== "None" && deal.competitor !== "Not specified"
      ? `Competitor: ${deal.competitor}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [header, "---", ...sections].join("\n\n");
}

// ── Matching functions ──────────────────────────────────────

/**
 * Find the best case study for a deal.
 * Priority: same industry + relevant stage > same industry > relevant stage > first available
 */
function findBestCaseStudy(
  deal: DealContext,
  caseStudies: CaseStudy[]
): CaseStudy | null {
  if (!caseStudies || caseStudies.length === 0) return null;

  const industry = deal.industry.toLowerCase();
  const stage = deal.deal_stage.toLowerCase();

  // Score each case study
  const scored = caseStudies.map((cs) => {
    let score = 0;
    if (cs.industry.toLowerCase() === industry) score += 10;
    if (cs.relevant_stages.some((s) => s.toLowerCase() === stage)) score += 5;
    // Partial industry match (e.g., "Financial" matches "Financial Services")
    if (
      score < 10 &&
      (cs.industry.toLowerCase().includes(industry) ||
        industry.includes(cs.industry.toLowerCase()))
    ) {
      score += 3;
    }
    return { cs, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return best match (or first if no scores)
  return scored[0].cs;
}

/**
 * Find competitor positioning by name (case-insensitive).
 */
function findCompetitorPositioning(
  competitor: string,
  positioning: CompetitorPositioning[]
): CompetitorPositioning | null {
  if (!positioning || positioning.length === 0 || !competitor) return null;

  const target = competitor.toLowerCase();
  return (
    positioning.find((cp) => cp.competitor.toLowerCase() === target) || null
  );
}

/**
 * Find relevant objections for a deal.
 * Matches by competitor (exact, case-insensitive) and stage relevance.
 * Returns up to 3 most relevant objections.
 */
function findRelevantObjections(
  deal: DealContext,
  objections: ObjectionEntry[]
): ObjectionEntry[] {
  if (!objections || objections.length === 0) return [];

  const competitor = deal.competitor.toLowerCase();
  const stage = deal.deal_stage.toLowerCase();

  // Score each objection
  const scored = objections.map((ob) => {
    let score = 0;
    // Competitor match is highest priority
    if (ob.competitor && ob.competitor.toLowerCase() === competitor) score += 10;
    // Stage relevance
    if (ob.relevant_stages.some((s) => s.toLowerCase() === stage)) score += 5;
    // General objections (no specific competitor) get a baseline score
    if (!ob.competitor && score === 0) score += 1;
    return { ob, score };
  });

  // Filter to only matching entries (score > 0) and sort
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.ob);
}

// ── Formatting functions ────────────────────────────────────

function formatCaseStudySection(cs: CaseStudy, deal: DealContext): string {
  const relevanceNote =
    cs.industry.toLowerCase() === deal.industry.toLowerCase()
      ? `Same industry (${cs.industry})`
      : `Closest match from ${cs.industry}`;

  const lines = [
    `RELEVANT CASE STUDY`,
    `${cs.company} (${cs.industry}, ${cs.segment})`,
    `Challenge: ${cs.challenge}`,
    `Result: ${cs.result}`,
    `Key Metric: ${cs.metric}`,
    `Why now: ${relevanceNote} — relevant at ${cs.relevant_stages.join(", ")} stages.`,
  ];

  if (cs.resources && cs.resources.length > 0) {
    lines.push(`Resources: ${cs.resources.map((r) => `${r.label}: ${r.url}`).join(" | ")}`);
  }

  return lines.join("\n");
}

function formatCompetitorSection(cp: CompetitorPositioning): string {
  const lines = [
    `COMPETITOR POSITIONING`,
    `Against ${cp.competitor} (${cp.category}):`,
    cp.differentiator,
  ];
  if (cp.supporting_evidence) {
    lines.push(`Evidence: ${cp.supporting_evidence}`);
  }
  if (cp.resources && cp.resources.length > 0) {
    lines.push(`Resources: ${cp.resources.map((r) => `${r.label}: ${r.url}`).join(" | ")}`);
  }
  return lines.join("\n");
}

function formatObjectionSection(objections: ObjectionEntry[]): string {
  const lines = [`TOP OBJECTION RESPONSES`];

  for (const ob of objections) {
    const competitorTag = ob.competitor ? ` [vs. ${ob.competitor}]` : "";
    lines.push(
      `\nObjection${competitorTag}: "${ob.objection}"`,
      `Response: ${ob.response}`
    );
  }

  return lines.join("\n");
}

function formatMethodologySection(
  methodology: KnowledgeBase["methodology"],
  dealStage: string
): string | null {
  if (!methodology) return null;

  const lines = [`METHODOLOGY: ${methodology.name}`];

  // Check for stage-specific guidance
  const stageGuidance = methodology.stage_guidance || {};
  const matchedStage = Object.keys(stageGuidance).find(
    (s) => s.toLowerCase() === dealStage.toLowerCase()
  );

  if (matchedStage) {
    lines.push(`At ${matchedStage}: ${stageGuidance[matchedStage]}`);
  } else {
    lines.push(methodology.description);
  }

  return lines.join("\n");
}
