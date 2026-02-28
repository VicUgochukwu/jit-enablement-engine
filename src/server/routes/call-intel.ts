/**
 * Call intel webhook — accepts deal summaries from any source
 * (Gong, Chorus, manual paste, Zapier integration).
 *
 * The lightest possible feedback channel: POST a JSON body with
 * { deal_name, summary } and it gets logged + PMM notified.
 */

import { Router } from "express";
import type { Config } from "../../shared/config.js";
import { appendFeedback } from "../../shared/data.js";
import { generateFeedbackId } from "../../shared/id.js";
import { buildFieldSignalNotification } from "../../feedback/notify.js";
import { sendSlackText } from "../../pipeline/send-slack.js";
import { sendTelegramText } from "../../pipeline/send-telegram.js";
import type { FeedbackEntry } from "../../shared/types.js";

export function createCallIntelRouter(config: Config): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const body = req.body as Record<string, unknown>;

    // ── Input validation ──────────────────────────────────
    const dealName = typeof body.deal_name === "string" ? body.deal_name.trim() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";

    if (!dealName || !summary) {
      res.status(400).json({
        error: "Missing required fields: deal_name, summary",
      });
      return;
    }

    if (dealName.length > 500) {
      res.status(400).json({ error: "deal_name exceeds 500 character limit" });
      return;
    }

    if (summary.length > 10_000) {
      res.status(400).json({ error: "summary exceeds 10,000 character limit" });
      return;
    }

    res.status(200).json({ received: true });

    const feedback: FeedbackEntry = {
      id: generateFeedbackId(),
      delivery_id: "",
      source: "call_intel",
      value: summary,
      raw_text: summary,
      rep_id: typeof body.rep_id === "string" ? body.rep_id.slice(0, 200) : "",
      deal_name: dealName,
      timestamp: new Date().toISOString(),
    };

    processCallIntel(feedback, config).catch((err) =>
      console.error("[JIT] Call intel error:", err)
    );
  });

  return router;
}

async function processCallIntel(
  feedback: FeedbackEntry,
  config: Config
): Promise<void> {
  appendFeedback(config.feedbackLogPath, feedback);

  console.log(
    `[JIT] Call intel: ${feedback.deal_name} — ${(feedback.raw_text || "").slice(0, 80)}...`
  );

  const notification = buildFieldSignalNotification(feedback);

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
