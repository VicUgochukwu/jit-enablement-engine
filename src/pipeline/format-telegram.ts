/**
 * Telegram message formatter — builds HTML-formatted message
 * with inline keyboard for feedback.
 */

import type { DealContext, KnowledgeBase, TelegramMessage } from "../shared/types.js";

/**
 * Format Claude's enablement response for Telegram delivery.
 *
 * Uses HTML parse_mode for rich formatting.
 * Includes inline keyboard buttons for feedback.
 */
export function formatTelegramMessage(
  deal: DealContext,
  claudeResponse: string,
  deliveryId: string,
  chatId: string
): TelegramMessage {
  const text =
    `<b>JIT Enablement Alert</b>\n\n` +
    `<b>Deal:</b> ${escapeHtml(deal.deal_name)}\n` +
    `<b>Stage:</b> ${escapeHtml(deal.deal_stage)}\n` +
    `<b>Company:</b> ${escapeHtml(deal.company_name)}\n\n` +
    `${escapeHtml(claudeResponse)}\n\n` +
    `---\n` +
    `<i>Reply if you heard something new on the call.</i>\n` +
    `<i>Ref: ${deliveryId}</i>`;

  return {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "\ud83d\udc4d Helpful", callback_data: `helpful:${deliveryId}` },
          { text: "\ud83d\udc4e Not helpful", callback_data: `not_helpful:${deliveryId}` },
        ],
      ],
    },
    delivery_id: deliveryId,
    deal_name: deal.deal_name,
    deal_stage: deal.deal_stage,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
