/**
 * Slack message formatter — builds a Block Kit message with
 * feedback buttons and delivery tracking.
 */

import type { DealContext, KnowledgeBase, SlackMessage } from "../shared/types.js";

/**
 * Format Claude's enablement response into a Slack Block Kit message.
 *
 * Includes:
 * - Deal context header
 * - Claude's enablement package
 * - Feedback buttons (thumbs up/down)
 * - Reply prompt for field intel
 * - Delivery ID for tracking
 */
export function formatSlackMessage(
  deal: DealContext,
  claudeResponse: string,
  deliveryId: string,
  kb: KnowledgeBase
): SlackMessage {
  // Track which KB entries were surfaced
  const caseStudiesSurfaced = (kb.case_studies || []).map((cs) => cs.id);
  const competitorsSurfaced = (kb.competitor_positioning || [])
    .filter((cp) => cp.competitor === deal.competitor)
    .map((cp) => cp.id);

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*JIT Enablement Alert*\n\n` +
          `*Deal:* ${deal.deal_name}\n` +
          `*Stage:* ${deal.deal_stage}\n` +
          `*Company:* ${deal.company_name}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: claudeResponse,
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "\ud83d\udc4d Helpful" },
          action_id: "feedback_helpful",
          value: deliveryId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "\ud83d\udc4e Not helpful" },
          action_id: "feedback_not_helpful",
          value: deliveryId,
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Reply to this thread if you heard something new on the call._ | _Ref: ${deliveryId}_`,
        },
      ],
    },
  ];

  return {
    channel: deal.rep_slack_id || "",
    blocks,
    text: `JIT Enablement: ${deal.deal_name} (${deal.deal_stage})`,
    delivery_id: deliveryId,
    deal_name: deal.deal_name,
    deal_stage: deal.deal_stage,
    company_name: deal.company_name,
    industry: deal.industry,
    competitor: deal.competitor,
    case_studies_surfaced: caseStudiesSurfaced,
    competitors_surfaced: competitorsSurfaced,
  };
}
