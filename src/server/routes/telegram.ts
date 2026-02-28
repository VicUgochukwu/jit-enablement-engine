/**
 * Telegram webhook route — receives bot updates (callback queries
 * from inline buttons and text replies from reps).
 */

import { Router } from "express";
import type { Config } from "../../shared/config.js";
import { appendFeedback, readFeedbackLog } from "../../shared/data.js";
import { parseFeedback } from "../../feedback/parse.js";
import { buildFieldSignalNotification } from "../../feedback/notify.js";
import {
  sendTelegramText,
  answerCallbackQuery,
  editMessageReplyMarkup,
} from "../../pipeline/send-telegram.js";
import { sendSlackText } from "../../pipeline/send-slack.js";
import type { FeedbackEntry } from "../../shared/types.js";

export function createTelegramRouter(config: Config): Router {
  const router = Router();

  router.post("/", (req, res) => {
    res.status(200).json({ ok: true });

    const body = req.body as Record<string, unknown>;

    // Handle callback query acknowledgment immediately
    if (body.callback_query && typeof body.callback_query === "object") {
      acknowledgeCallback(
        body.callback_query as Record<string, unknown>,
        config
      ).catch((err) => console.error("[JIT] Callback ack error:", err));
    }

    const result = parseFeedback(body);

    if (!result || "challenge" in result) {
      return;
    }

    processTelegramFeedback(result, config).catch((err) =>
      console.error("[JIT] Telegram feedback error:", err)
    );
  });

  return router;
}

/**
 * Acknowledge a Telegram callback query — shows toast and replaces
 * buttons with a "✓ Clicked" confirmation so the rep sees feedback.
 */
async function acknowledgeCallback(
  cb: Record<string, unknown>,
  config: Config
): Promise<void> {
  const callbackId = String(cb.id || "");
  const cbData = String(cb.data || "");
  const isHelpful = cbData.startsWith("helpful");

  // 1. Show toast notification to the rep
  const toastText = isHelpful
    ? "✓ Marked as helpful"
    : "✓ Marked as not helpful";
  await answerCallbackQuery(callbackId, toastText, config.telegramBotToken);

  // 2. Replace buttons with a single "clicked" label
  const message = cb.message as Record<string, unknown> | undefined;
  if (message?.message_id && message?.chat) {
    const chat = message.chat as Record<string, unknown>;
    const chatId = String(chat.id || "");
    const messageId = Number(message.message_id);

    const clickedLabel = isHelpful ? "✅ Helpful" : "❌ Not helpful";
    await editMessageReplyMarkup(
      chatId,
      messageId,
      {
        inline_keyboard: [[{ text: clickedLabel, callback_data: "noop" }]],
      },
      config.telegramBotToken
    );
  }
}

async function processTelegramFeedback(
  feedback: FeedbackEntry,
  config: Config
): Promise<void> {
  appendFeedback(config.feedbackLogPath, feedback);

  console.log(
    `[JIT] Telegram feedback: ${feedback.source} → ${feedback.value}`
  );

  // Notify PMM of field signals
  if (feedback.source === "reply" || feedback.source === "call_intel") {
    const log = readFeedbackLog(config.feedbackLogPath);
    const delivery = log.deliveries.find(
      (d) => d.delivery_id === feedback.delivery_id
    );

    const notification = buildFieldSignalNotification(feedback, delivery);

    if (config.pmmTelegramChatId) {
      await sendTelegramText(
        config.pmmTelegramChatId,
        notification.text,
        config.telegramBotToken
      );
    } else if (config.pmmSlackId) {
      await sendSlackText(
        config.pmmSlackId,
        notification.text,
        config.slackBotToken
      );
    }
  }
}
