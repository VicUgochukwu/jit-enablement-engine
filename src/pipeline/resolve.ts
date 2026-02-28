/**
 * Rep identity resolution — figures out how to reach the sales rep.
 *
 * Resolution chain (Slack-first):
 * 1. CRM payload has Slack user ID directly → use it
 * 2. Rep directory has a cached mapping for this email → use it
 * 3. Slack API lookup: users.lookupByEmail → cache result in directory
 * 4. Email fallback — Slack can sometimes DM by email
 * 5. Unresolved — logs warning, message delivery may fail
 *
 * For Telegram: checks rep directory for telegram_chat_id.
 */

import type { DealContext } from "../shared/types.js";
import { findRepByEmail, upsertRep } from "../shared/data.js";

/**
 * Resolve the rep's messaging identity.
 * Synchronous — checks CRM fields and local rep directory.
 */
export function resolveRepIdentity(
  deal: DealContext,
  repDirectoryPath?: string
): DealContext {
  let repSlackId = deal.rep_slack_id;
  let resolutionMethod = "unresolved";

  // 1. Already have a Slack ID from CRM
  if (repSlackId) {
    return {
      ...deal,
      rep_slack_id: repSlackId,
      _identity_resolved: true,
      _resolution_method: "crm_field",
    };
  }

  // 2. Check rep directory by email
  if (deal.rep_email && repDirectoryPath) {
    const rep = findRepByEmail(repDirectoryPath, deal.rep_email);
    if (rep?.slack_id) {
      return {
        ...deal,
        rep_slack_id: rep.slack_id,
        _identity_resolved: true,
        _resolution_method: "rep_directory",
      };
    }
  }

  // 3. Email fallback — Slack API lookup happens async (see resolveRepViaSlackApi)
  if (deal.rep_email) {
    repSlackId = deal.rep_email;
    resolutionMethod = "email_fallback";
  }

  return {
    ...deal,
    rep_slack_id: repSlackId,
    _identity_resolved: !!repSlackId,
    _resolution_method: resolutionMethod,
  };
}

/**
 * Async resolution: call Slack's users.lookupByEmail API to get the
 * user's Slack ID from their email. Caches the result in the rep directory.
 *
 * Call this in the pipeline AFTER resolveRepIdentity when the method is
 * "email_fallback" and we have a Slack bot token.
 */
export async function resolveRepViaSlackApi(
  deal: DealContext,
  slackBotToken: string,
  repDirectoryPath: string
): Promise<DealContext> {
  if (!deal.rep_email || !slackBotToken) {
    return deal;
  }

  try {
    const response = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(deal.rep_email)}`,
      {
        headers: { Authorization: `Bearer ${slackBotToken}` },
      }
    );

    const result = (await response.json()) as {
      ok: boolean;
      user?: { id: string; real_name?: string };
      error?: string;
    };

    if (result.ok && result.user?.id) {
      // Cache in rep directory for future lookups
      upsertRep(repDirectoryPath, {
        email: deal.rep_email,
        name: result.user.real_name || deal.rep_email,
        slack_id: result.user.id,
        telegram_chat_id: "",
        registered_at: new Date().toISOString(),
        registered_via: "manual",
      });

      console.log(
        `[JIT] Resolved rep → Slack ID ${result.user.id} (cached via API lookup)`
      );

      return {
        ...deal,
        rep_slack_id: result.user.id,
        _identity_resolved: true,
        _resolution_method: "slack_api_lookup",
      };
    }

    console.log(
      `[JIT] Slack lookup failed for rep: ${result.error}`
    );
  } catch (err) {
    console.error(`[JIT] Slack API error:`, err);
  }

  return deal;
}

/**
 * Resolve rep identity for Telegram channel.
 * Checks rep directory for telegram_chat_id mapped to rep email.
 */
export function resolveRepForTelegram(
  deal: DealContext,
  repDirectoryPath: string
): DealContext {
  if (!deal.rep_email) {
    return {
      ...deal,
      _identity_resolved: false,
      _resolution_method: "unresolved",
    };
  }

  const rep = findRepByEmail(repDirectoryPath, deal.rep_email);
  if (rep?.telegram_chat_id) {
    return {
      ...deal,
      rep_slack_id: rep.telegram_chat_id, // Overload field for Telegram routing
      _identity_resolved: true,
      _resolution_method: "rep_directory_telegram",
    };
  }

  return {
    ...deal,
    _identity_resolved: false,
    _resolution_method: "no_telegram_id",
  };
}
