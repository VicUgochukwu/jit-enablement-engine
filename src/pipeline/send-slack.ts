/**
 * Slack sender — posts messages via the Slack Web API.
 * Uses chat.postMessage with Block Kit support.
 */

import type { SlackMessage } from "../shared/types.js";

/**
 * Send a Slack DM to the sales rep.
 *
 * @returns Slack API response or error details
 */
export async function sendSlackDM(
  message: SlackMessage,
  botToken: string
): Promise<{ ok: boolean; error?: string; ts?: string }> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: message.channel,
      blocks: message.blocks,
      text: message.text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const result = (await response.json()) as {
    ok: boolean;
    error?: string;
    ts?: string;
  };

  if (!result.ok) {
    console.error(
      `Slack API error: ${result.error} (channel: ${message.channel})`
    );
  }

  return result;
}

/**
 * Send a plain text Slack DM (used for PMM notifications).
 */
export async function sendSlackText(
  channel: string,
  text: string,
  botToken: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  return (await response.json()) as { ok: boolean; error?: string };
}
