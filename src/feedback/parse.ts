/**
 * Feedback parser — normalizes feedback from multiple sources
 * into a unified FeedbackEntry.
 *
 * Ported from the n8n "Parse Interaction" Function node.
 * Handles: Slack buttons, Slack thread replies, Telegram callbacks,
 * Telegram text replies, and call intel POSTs.
 */

import type { FeedbackEntry, FeedbackSource } from "../shared/types.js";
import { generateFeedbackId } from "../shared/id.js";

/**
 * Parse a raw webhook payload into a FeedbackEntry.
 * Returns null if the payload doesn't match any known format.
 *
 * Also returns a special { challenge } object for Slack URL verification.
 */
export function parseFeedback(
  body: Record<string, unknown>
): FeedbackEntry | null | { challenge: string } {
  const timestamp = new Date().toISOString();

  // ── Slack URL Verification ─────────────────────────────
  if (body.type === "url_verification" && body.challenge) {
    return { challenge: String(body.challenge) };
  }

  // ── Slack Interactive Payload (button click) ───────────
  if (body.payload) {
    let parsed: Record<string, unknown>;
    try {
      parsed =
        typeof body.payload === "string"
          ? (JSON.parse(body.payload) as Record<string, unknown>)
          : (body.payload as Record<string, unknown>);
    } catch {
      console.log("[JIT] Feedback: malformed JSON in payload field, skipped");
      return null;
    }

    const actions = parsed.actions as Array<Record<string, unknown>> | undefined;
    const action = actions?.[0];

    if (action) {
      const user = parsed.user as Record<string, unknown> | undefined;
      return {
        id: generateFeedbackId(),
        delivery_id: String(action.value || ""),
        source: "reaction" as FeedbackSource,
        value:
          action.action_id === "feedback_helpful"
            ? "helpful"
            : "not_helpful",
        raw_text: null,
        rep_id: String(user?.id || ""),
        deal_name: "",
        timestamp,
      };
    }
  }

  // ── Slack Events API (thread reply) ────────────────────
  if (body.event && typeof body.event === "object") {
    const event = body.event as Record<string, unknown>;
    if (event.text && event.thread_ts) {
      return {
        id: generateFeedbackId(),
        delivery_id: `thread-${String(event.thread_ts)}`,
        source: "reply" as FeedbackSource,
        value: "field_signal",
        raw_text: String(event.text),
        rep_id: String(event.user || ""),
        deal_name: "",
        timestamp,
      };
    }
  }

  // ── Telegram Callback Query (inline button) ────────────
  if (body.callback_query && typeof body.callback_query === "object") {
    const cb = body.callback_query as Record<string, unknown>;
    const cbData = String(cb.data || "").split(":");
    const from = cb.from as Record<string, unknown> | undefined;

    return {
      id: generateFeedbackId(),
      delivery_id: cbData[1] || "",
      source: "reaction" as FeedbackSource,
      value: cbData[0] || "",
      raw_text: null,
      rep_id: from?.id ? String(from.id) : "",
      deal_name: "",
      timestamp,
    };
  }

  // ── Telegram Text Reply (field signal from rep) ────────
  if (body.message && typeof body.message === "object") {
    const msg = body.message as Record<string, unknown>;
    const replyTo = msg.reply_to_message as Record<string, unknown> | undefined;

    if (msg.text && replyTo) {
      const from = msg.from as Record<string, unknown> | undefined;
      return {
        id: generateFeedbackId(),
        delivery_id: `tg-msg-${String(replyTo.message_id || "")}`,
        source: "reply" as FeedbackSource,
        value: "field_signal",
        raw_text: String(msg.text),
        rep_id: from?.id ? String(from.id) : "",
        deal_name: "",
        timestamp,
      };
    }
  }

  // ── Call Intel or Manual POST ───────────────────────────
  if (body.deal_name && body.summary) {
    return {
      id: generateFeedbackId(),
      delivery_id: "",
      source: "call_intel" as FeedbackSource,
      value: String(body.summary),
      raw_text: String(body.summary),
      rep_id: "",
      deal_name: String(body.deal_name),
      timestamp,
    };
  }

  // Unknown payload format
  return null;
}
