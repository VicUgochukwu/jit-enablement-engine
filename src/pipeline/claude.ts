/**
 * Claude API caller — sends the enablement prompt to Claude
 * and returns the response text.
 *
 * Uses the official @anthropic-ai/sdk instead of raw HTTP.
 * Replaces the n8n HTTP Request node.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Call Claude API with an enablement prompt.
 *
 * @param prompt - The fully constructed prompt with KB context
 * @param apiKey - Anthropic API key
 * @returns Claude's response text
 */
export async function callClaude(
  prompt: string,
  apiKey: string
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      "Claude API returned no text content. " +
        `Stop reason: ${response.stop_reason}`
    );
  }

  return textBlock.text;
}
