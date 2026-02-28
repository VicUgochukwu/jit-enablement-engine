/**
 * Telegram sender — posts messages via the Telegram Bot API.
 */

import type { TelegramMessage } from "../shared/types.js";

/**
 * Send a Telegram message with inline keyboard.
 */
export async function sendTelegramMessage(
  message: TelegramMessage,
  botToken: string
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: message.chat_id,
      text: message.text,
      parse_mode: message.parse_mode,
      reply_markup: message.reply_markup,
    }),
  });

  const result = (await response.json()) as {
    ok: boolean;
    description?: string;
  };

  if (!result.ok) {
    console.error(
      `Telegram API error: ${result.description} (chat_id: ${message.chat_id})`
    );
  }

  return result;
}

/**
 * Answer a callback query (acknowledge a button press).
 * Shows a brief toast notification to the user.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
  botToken: string
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });

  return (await response.json()) as { ok: boolean; description?: string };
}

/**
 * Edit a message's inline keyboard (replace buttons with a clicked state).
 */
export async function editMessageReplyMarkup(
  chatId: string,
  messageId: number,
  replyMarkup: Record<string, unknown> | null,
  botToken: string
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup || { inline_keyboard: [] },
    }),
  });

  return (await response.json()) as { ok: boolean; description?: string };
}

/**
 * Send a plain text Telegram message (used for PMM notifications).
 */
export async function sendTelegramText(
  chatId: string,
  text: string,
  botToken: string
): Promise<{ ok: boolean; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  return (await response.json()) as { ok: boolean; description?: string };
}
