# Claude Prompt Template — JIT Enablement Engine

This document shows the exact prompt structure that the engine sends to Claude when a deal reaches an enablement stage.

The webhook server builds this prompt automatically by injecting your knowledge base content. You never need to write prompts manually.

## Template Structure

```
You are a sales enablement AI assistant. Generate a personalized enablement
package for the following deal.

═══ DEAL CONTEXT ═══════════════════════════════════════════

Deal: {deal_name}
Stage: {deal_stage}
Company: {company_name}
Industry: {industry}
Competitor: {competitor}
Deal Size: ${deal_size}
Notes: {deal_notes}
Product Interest: {product_interest}

═══ CASE STUDIES ════════════════════════════════════════════

{case_studies_section}

═══ COMPETITOR POSITIONING ═════════════════════════════════

{competitor_section}

═══ SALES METHODOLOGY ══════════════════════════════════════

{methodology_section}

═══ CRITICAL CONSTRAINTS ═══════════════════════════════════

1. Do NOT invent, fabricate, or hallucinate any case studies, metrics,
   or customer names. Only use the case studies provided above.

2. If no relevant case study exists for this industry or competitor,
   say so explicitly. Do NOT make one up.

3. Keep the response under 500 words. Sales reps need actionable
   brevity, not essays.

4. Use the exact metrics from the case studies. Do not round,
   approximate, or embellish numbers.

5. If competitor positioning is available, include a one-liner
   the rep can use verbatim.

6. Structure the response as:
   - Opening context (1-2 sentences on the deal)
   - Relevant case study (if available)
   - Competitor positioning (if available)
   - Suggested next step (based on methodology if configured)

═══ END ════════════════════════════════════════════════════
```

## How Sections Are Populated

### Case Studies Section
When your KB has case studies matching the deal's industry or stage:
```
[cs-001] FinServ Corp (Financial Services, Enterprise)
Challenge: Pipeline velocity stalling at proposal stage
Result: 45% pipeline velocity increase within 3 months
Metric: 45% pipeline velocity increase
Relevant stages: Proposal Sent, Negotiation
```

When no case studies exist:
```
No case studies available. Do not fabricate any.
```

### Competitor Section
When positioning exists for the deal's competitor:
```
vs. Gong (Conversation Intelligence):
We offer real-time coaching during live calls, not just post-call analysis.
Evidence: Reps using live coaching close 23% more deals.
```

When no positioning exists:
```
No competitor positioning available for this competitor.
```

### Methodology Section
When a methodology is configured:
```
Methodology: MEDDIC
Focus on Metrics and Decision Criteria. Quantify the business impact.
```

When no methodology is set:
```
No specific sales methodology configured.
```

## Model Configuration

| Setting | Value |
|---------|-------|
| Model | claude-sonnet-4-6 |
| Max tokens | 1500 |
| System prompt | (none - all context in user message) |

The engine uses `@anthropic-ai/sdk` for typed, retry-safe API calls.
