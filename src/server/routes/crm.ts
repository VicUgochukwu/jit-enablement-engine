/**
 * CRM webhook route — receives deal stage changes and runs
 * the enablement pipeline or outcome tracking.
 *
 * Responds 200 immediately, processes asynchronously.
 * CRMs (HubSpot, Salesforce, Attio, Pipedrive, Close) timeout
 * at ~10s but the Claude API call takes 5-15s.
 */

import { Router } from "express";
import type { Config } from "../../shared/config.js";
import { readKB, readFeedbackLog, appendFeedback } from "../../shared/data.js";
import { generateDeliveryId, generateFeedbackId } from "../../shared/id.js";
import { classifyStage, extractStage } from "../../pipeline/filter.js";
import { parseCrmPayload } from "../../pipeline/parse.js";
import { enrichDealContext } from "../../pipeline/enrich.js";
import {
  resolveRepIdentity,
  resolveRepViaSlackApi,
  resolveRepForTelegram,
} from "../../pipeline/resolve.js";
import { contextGate } from "../../pipeline/gate.js";
import { buildPrompt } from "../../pipeline/prompt.js";
import { callClaude } from "../../pipeline/claude.js";
import { buildTemplateEnablement } from "../../pipeline/template.js";
import { formatSlackMessage } from "../../pipeline/format-slack.js";
import { formatTelegramMessage } from "../../pipeline/format-telegram.js";
import { sendSlackDM, sendSlackText } from "../../pipeline/send-slack.js";
import { sendTelegramMessage, sendTelegramText } from "../../pipeline/send-telegram.js";
import { logDelivery } from "../../pipeline/log.js";
import { buildOutcomeNotification } from "../../feedback/notify.js";

export function createCrmRouter(config: Config): Router {
  const router = Router();

  router.post("/", (req, res) => {
    // Respond immediately — pipeline runs async
    res.status(200).json({ received: true });

    const raw = req.body as Record<string, unknown>;
    const stage = extractStage(raw);
    const stageType = classifyStage(stage);

    if (stageType === "skip") {
      console.log(`[JIT] Skipped: stage "${stage}" not in target list`);
      return;
    }

    if (stageType === "enablement") {
      processEnablementPipeline(raw, config).catch((err) =>
        console.error("[JIT] Enablement pipeline error:", err)
      );
    }

    if (stageType === "outcome") {
      processOutcome(raw, stage, config).catch((err) =>
        console.error("[JIT] Outcome tracking error:", err)
      );
    }
  });

  return router;
}

// ── Enablement Pipeline ─────────────────────────────────────

async function processEnablementPipeline(
  raw: Record<string, unknown>,
  config: Config
): Promise<void> {
  // 1. Parse CRM payload
  let deal = parseCrmPayload(raw);

  // 2. Enrich with defaults
  deal = enrichDealContext(deal);

  // 3. Resolve rep identity — Slack-first resolution chain
  deal = resolveRepIdentity(deal, config.repDirectoryPath);

  // 3b. For Slack: if only email fallback, try Slack API lookup
  if (
    config.channel === "slack" &&
    deal._resolution_method === "email_fallback" &&
    config.slackBotToken
  ) {
    deal = await resolveRepViaSlackApi(
      deal,
      config.slackBotToken,
      config.repDirectoryPath
    );
  }

  // 3c. For Telegram: resolve via rep directory
  if (config.channel === "telegram") {
    deal = resolveRepForTelegram(deal, config.repDirectoryPath);

    // Fallback: if no rep-specific Telegram ID, send to PMM
    if (!deal._identity_resolved && config.pmmTelegramChatId) {
      deal = {
        ...deal,
        rep_slack_id: config.pmmTelegramChatId,
        _identity_resolved: true,
        _resolution_method: "pmm_fallback",
      };
      console.log(
        `[JIT] No Telegram ID for rep — falling back to PMM chat`
      );
    }
  }

  if (!deal._identity_resolved) {
    console.log(
      `[JIT] UNRESOLVED: Cannot reach rep for "${deal.deal_name}" — ` +
        `no Slack ID, no email, no directory match. Skipping delivery.`
    );
    return;
  }

  // 4. Read KB and check gate
  const kb = readKB(config.kbPath);
  if (!contextGate(kb)) {
    console.log(
      `[JIT] BLOCKED: KB not configured. No content sent for "${deal.deal_name}".`
    );
    return;
  }

  // 5. Generate enablement content (Claude API or template-based)
  let enablementContent: string;
  if (config.anthropicApiKey) {
    const prompt = buildPrompt(deal, kb);
    enablementContent = await callClaude(prompt, config.anthropicApiKey);
  } else {
    enablementContent = buildTemplateEnablement(deal, kb);
    console.log(`[JIT] Using template-based enablement (no API key set)`);
  }

  // 6. Generate delivery ID
  const deliveryId = generateDeliveryId();

  // 7. Format and send based on channel
  if (config.channel === "telegram" && config.telegramBotToken) {
    const telegramMsg = formatTelegramMessage(
      deal,
      enablementContent,
      deliveryId,
      deal.rep_slack_id // Holds Telegram chat ID from rep directory or PMM fallback
    );
    await sendTelegramMessage(telegramMsg, config.telegramBotToken);
  } else {
    const slackMsg = formatSlackMessage(deal, enablementContent, deliveryId, kb);
    await sendSlackDM(slackMsg, config.slackBotToken);
  }

  // 8. Log delivery
  logDelivery(deal, kb, deliveryId, config.channel, config.feedbackLogPath);

  console.log(
    `[JIT] ✓ Delivered: "${deal.deal_name}" via ${config.channel} (${deal._resolution_method})`
  );
}

// ── Outcome Tracking ────────────────────────────────────────

async function processOutcome(
  raw: Record<string, unknown>,
  stage: string,
  config: Config
): Promise<void> {
  const deal = parseCrmPayload(raw);
  const feedbackLog = readFeedbackLog(config.feedbackLogPath);

  // Find matching deliveries for this deal
  const matchingDeliveries = feedbackLog.deliveries.filter(
    (d) => d.deal_name === deal.deal_name
  );

  if (matchingDeliveries.length === 0) {
    console.log(
      `[JIT] Outcome: ${deal.deal_name} → ${stage} (no prior enablement)`
    );
    return;
  }

  // Log outcome feedback entry
  const outcomeEntry = {
    id: generateFeedbackId(),
    delivery_id: matchingDeliveries[0].delivery_id,
    source: "outcome" as const,
    value: stage === "Closed Won" ? "closed_won" : "closed_lost",
    raw_text: null,
    rep_id: matchingDeliveries[0].rep_id,
    deal_name: deal.deal_name,
    timestamp: new Date().toISOString(),
  };
  appendFeedback(config.feedbackLogPath, outcomeEntry);

  // Notify PMM
  const notification = buildOutcomeNotification(
    deal.deal_name,
    stage,
    deal.company_name,
    deal.industry,
    deal.deal_size,
    matchingDeliveries[0]
  );

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

  console.log(
    `[JIT] Outcome: ${deal.deal_name} → ${stage} (enabled at ${matchingDeliveries[0].deal_stage})`
  );
}
