/**
 * PMM notification builder — formats outcome and field signal
 * notifications for the PMM.
 *
 * The PMM receives:
 * 1. Deal outcome alerts (Closed Won/Lost for enabled deals)
 * 2. Field signal alerts (rep replies, call intel with new objections)
 */

import type {
  FeedbackEntry,
  DeliveryEntry,
  PmmNotification,
} from "../shared/types.js";

/**
 * Build a PMM notification from a deal outcome event.
 */
export function buildOutcomeNotification(
  dealName: string,
  outcome: string,
  companyName: string,
  industry: string,
  dealSize: number,
  delivery?: DeliveryEntry
): PmmNotification {
  const isWon = outcome === "Closed Won";
  const emoji = isWon ? "\ud83c\udf89" : "\ud83d\udcc9";
  const sizeStr = dealSize > 0 ? ` ($${dealSize.toLocaleString()})` : "";

  let text =
    `${emoji} *Deal Outcome: ${outcome}*\n\n` +
    `*Deal:* ${dealName}${sizeStr}\n` +
    `*Company:* ${companyName}\n` +
    `*Industry:* ${industry}\n\n`;

  if (delivery) {
    text += `This deal received enablement at ${delivery.deal_stage} on ${delivery.timestamp}.\n`;
    if (delivery.case_studies_surfaced.length > 0) {
      text += `Case studies used: ${delivery.case_studies_surfaced.join(", ")}\n`;
    }
    if (delivery.competitors_surfaced.length > 0) {
      text += `Competitor positioning used: ${delivery.competitors_surfaced.join(", ")}\n`;
    }
    text += "\n";
  }

  if (isWon) {
    text +=
      "_Check your feedback summary to see if enablement content contributed to this win._";
  } else {
    text +=
      "_Review field signals and feedback to identify what could improve for similar deals._";
  }

  text += "\n_Powered by JIT Enablement Engine_";

  return {
    text,
    deal_name: dealName,
    type: "outcome",
  };
}

/**
 * Build a PMM notification from a field signal (rep reply or call intel).
 */
export function buildFieldSignalNotification(
  feedback: FeedbackEntry,
  delivery?: DeliveryEntry
): PmmNotification {
  const emoji = feedback.source === "call_intel" ? "\ud83d\udcde" : "\ud83d\udcac";
  const sourceLabel =
    feedback.source === "call_intel" ? "Call intel" : "Rep reply";

  const dealInfo = feedback.deal_name
    ? feedback.deal_name
    : delivery
      ? `${delivery.deal_name} (${delivery.deal_stage}, ${delivery.industry})`
      : "Unknown deal";

  const text =
    `${emoji} *${sourceLabel}* on ${dealInfo}\n\n` +
    `"${feedback.raw_text || feedback.value}"\n` +
    `\u2014 ${feedback.rep_id || "Unknown rep"}, ${feedback.timestamp}\n\n` +
    `_Check if your knowledge base covers this. Update if needed._`;

  return {
    text,
    deal_name: feedback.deal_name || delivery?.deal_name || "",
    type: "field_signal",
  };
}
