/**
 * Feedback webhook route — receives Slack interactive payloads
 * (button clicks) and Events API events (thread replies).
 */

import { Router } from "express";
import type { Config } from "../../shared/config.js";
import { appendFeedback, readFeedbackLog } from "../../shared/data.js";
import { parseFeedback } from "../../feedback/parse.js";
import { buildFieldSignalNotification } from "../../feedback/notify.js";
import { sendSlackText } from "../../pipeline/send-slack.js";
import { sendTelegramText } from "../../pipeline/send-telegram.js";
import type { FeedbackEntry } from "../../shared/types.js";

export function createFeedbackRouter(config: Config): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const body = req.body as Record<string, unknown>;
    const result = parseFeedback(body);

    // Handle Slack URL verification challenge
    if (result && "challenge" in result) {
      res.status(200).json({ challenge: result.challenge });
      return;
    }

    // Respond 200 immediately
    res.status(200).json({ ok: true });

    if (!result) {
      console.log("[JIT] Feedback: unknown payload format, skipped");
      return;
    }

    // Process async
    processFeedback(result, config).catch((err) =>
      console.error("[JIT] Feedback processing error:", err)
    );
  });

  return router;
}

async function processFeedback(
  feedback: FeedbackEntry,
  config: Config
): Promise<void> {
  // Append to local feedback log
  appendFeedback(config.feedbackLogPath, feedback);

  console.log(
    `[JIT] Feedback: ${feedback.source} → ${feedback.value} [${feedback.delivery_id}]`
  );

  // If it's a field signal (reply or call_intel), notify PMM
  if (feedback.source === "reply" || feedback.source === "call_intel") {
    // Look up the delivery to get deal context
    const log = readFeedbackLog(config.feedbackLogPath);
    const delivery = log.deliveries.find(
      (d) => d.delivery_id === feedback.delivery_id
    );

    const notification = buildFieldSignalNotification(feedback, delivery);

    if (config.channel === "telegram" && config.pmmTelegramChatId) {
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
