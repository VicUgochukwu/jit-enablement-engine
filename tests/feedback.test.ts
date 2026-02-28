/**
 * Feedback module tests — covers parsing of multi-source feedback
 * payloads and PMM notification formatting.
 */

import { describe, it, expect } from "vitest";
import { parseFeedback } from "../src/feedback/parse.js";
import {
  buildOutcomeNotification,
  buildFieldSignalNotification,
} from "../src/feedback/notify.js";
import {
  slackButtonPayload,
  slackNotHelpfulPayload,
  slackThreadReplyPayload,
  slackVerificationPayload,
  telegramCallbackPayload,
  telegramReplyPayload,
  callIntelPayload,
} from "./fixtures/payloads.js";
import { populatedFeedbackLog } from "./fixtures/knowledge-base.js";

// ============================================================
// SLACK BUTTON CLICK
// ============================================================

describe("Slack Button Click", () => {
  const result = parseFeedback(slackButtonPayload);

  it("returns a FeedbackEntry", () => {
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("challenge");
  });

  it("has source = reaction", () => {
    expect((result as Record<string, unknown>).source).toBe("reaction");
  });

  it("has value = helpful", () => {
    expect((result as Record<string, unknown>).value).toBe("helpful");
  });

  it("extracts delivery ID", () => {
    expect((result as Record<string, unknown>).delivery_id).toBe(
      "del-test123"
    );
  });

  it("extracts rep ID", () => {
    expect((result as Record<string, unknown>).rep_id).toBe("U12345");
  });

  it("has a generated ID", () => {
    expect((result as Record<string, unknown>).id).toMatch(/^fb-/);
  });

  it("has a timestamp", () => {
    expect((result as Record<string, unknown>).timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    );
  });
});

// ============================================================
// SLACK NOT HELPFUL BUTTON
// ============================================================

describe("Slack Not Helpful Button", () => {
  const result = parseFeedback(slackNotHelpfulPayload);

  it("has value = not_helpful", () => {
    expect((result as Record<string, unknown>).value).toBe("not_helpful");
  });

  it("extracts delivery ID", () => {
    expect((result as Record<string, unknown>).delivery_id).toBe(
      "del-test456"
    );
  });

  it("extracts rep ID", () => {
    expect((result as Record<string, unknown>).rep_id).toBe("U67890");
  });
});

// ============================================================
// SLACK THREAD REPLY
// ============================================================

describe("Slack Thread Reply", () => {
  const result = parseFeedback(slackThreadReplyPayload);

  it("has source = reply", () => {
    expect((result as Record<string, unknown>).source).toBe("reply");
  });

  it("has value = field_signal", () => {
    expect((result as Record<string, unknown>).value).toBe("field_signal");
  });

  it("extracts thread-based delivery ID", () => {
    expect((result as Record<string, unknown>).delivery_id).toBe(
      "thread-1234567890.123456"
    );
  });

  it("extracts raw text", () => {
    expect((result as Record<string, unknown>).raw_text).toContain(
      "SOC 2 compliance"
    );
  });

  it("extracts rep ID from event", () => {
    expect((result as Record<string, unknown>).rep_id).toBe("U12345");
  });
});

// ============================================================
// SLACK URL VERIFICATION
// ============================================================

describe("Slack URL Verification", () => {
  const result = parseFeedback(slackVerificationPayload);

  it("returns challenge object", () => {
    expect(result).toHaveProperty("challenge");
  });

  it("has correct challenge value", () => {
    expect((result as Record<string, unknown>).challenge).toBe(
      "abc123challenge"
    );
  });
});

// ============================================================
// TELEGRAM CALLBACK QUERY
// ============================================================

describe("Telegram Callback Query", () => {
  const result = parseFeedback(telegramCallbackPayload);

  it("has source = reaction", () => {
    expect((result as Record<string, unknown>).source).toBe("reaction");
  });

  it("extracts value from callback data", () => {
    expect((result as Record<string, unknown>).value).toBe("helpful");
  });

  it("extracts delivery ID from callback data", () => {
    expect((result as Record<string, unknown>).delivery_id).toBe("del-tg789");
  });

  it("extracts rep ID from from.id", () => {
    expect((result as Record<string, unknown>).rep_id).toBe("987654321");
  });
});

// ============================================================
// TELEGRAM TEXT REPLY
// ============================================================

describe("Telegram Text Reply", () => {
  const result = parseFeedback(telegramReplyPayload);

  it("has source = reply", () => {
    expect((result as Record<string, unknown>).source).toBe("reply");
  });

  it("has value = field_signal", () => {
    expect((result as Record<string, unknown>).value).toBe("field_signal");
  });

  it("extracts raw text", () => {
    expect((result as Record<string, unknown>).raw_text).toContain(
      "real-time coaching"
    );
  });

  it("extracts delivery ID from reply_to_message", () => {
    expect((result as Record<string, unknown>).delivery_id).toBe("tg-msg-42");
  });

  it("extracts rep ID from from.id", () => {
    expect((result as Record<string, unknown>).rep_id).toBe("111222333");
  });
});

// ============================================================
// CALL INTEL
// ============================================================

describe("Call Intel Parsing", () => {
  const result = parseFeedback(callIntelPayload);

  it("has source = call_intel", () => {
    expect((result as Record<string, unknown>).source).toBe("call_intel");
  });

  it("extracts deal name", () => {
    expect((result as Record<string, unknown>).deal_name).toBe("Acme Corp");
  });

  it("extracts summary as value and raw_text", () => {
    const entry = result as Record<string, unknown>;
    expect(entry.value).toContain("SOC 2 compliance");
    expect(entry.raw_text).toContain("SOC 2 compliance");
  });
});

// ============================================================
// UNKNOWN PAYLOAD
// ============================================================

describe("Unknown Payload", () => {
  it("returns null for empty object", () => {
    expect(parseFeedback({})).toBeNull();
  });

  it("returns null for unrecognized shape", () => {
    expect(parseFeedback({ foo: "bar", baz: 123 })).toBeNull();
  });
});

// ============================================================
// OUTCOME NOTIFICATION
// ============================================================

describe("Outcome Notification", () => {
  it("builds Closed Won notification", () => {
    const notif = buildOutcomeNotification(
      "Acme Corp Enterprise Platform",
      "Closed Won",
      "Acme Corp",
      "Financial Services",
      150000
    );

    expect(notif.text).toContain("Closed Won");
    expect(notif.text).toContain("Acme Corp Enterprise Platform");
    expect(notif.text).toContain("$150,000");
    expect(notif.text).toContain("Financial Services");
    expect(notif.type).toBe("outcome");
  });

  it("builds Closed Lost notification", () => {
    const notif = buildOutcomeNotification(
      "Beta Inc Expansion",
      "Closed Lost",
      "Beta Inc",
      "Healthcare",
      80000
    );

    expect(notif.text).toContain("Closed Lost");
    expect(notif.text).toContain("Beta Inc Expansion");
    expect(notif.text).toContain("improve for similar deals");
  });

  it("includes delivery context when provided", () => {
    const delivery = populatedFeedbackLog.deliveries[0];
    const notif = buildOutcomeNotification(
      "Acme Corp Enterprise Platform",
      "Closed Won",
      "Acme Corp",
      "Financial Services",
      150000,
      delivery
    );

    expect(notif.text).toContain("received enablement");
    expect(notif.text).toContain("cs-001");
  });

  it("handles zero deal size", () => {
    const notif = buildOutcomeNotification(
      "Unknown Deal",
      "Closed Won",
      "Unknown Corp",
      "Technology",
      0
    );

    // Should not include ($0) in the output
    expect(notif.text).not.toContain("$0");
  });
});

// ============================================================
// FIELD SIGNAL NOTIFICATION
// ============================================================

describe("Field Signal Notification", () => {
  it("builds rep reply notification", () => {
    const feedback = {
      id: "fb-test1",
      delivery_id: "del-test1",
      source: "reply" as const,
      value: "field_signal",
      raw_text: "Prospect asked about SOC 2",
      rep_id: "U12345",
      deal_name: "",
      timestamp: "2025-01-15T10:00:00Z",
    };

    const notif = buildFieldSignalNotification(feedback);

    expect(notif.text).toContain("Rep reply");
    expect(notif.text).toContain("SOC 2");
    expect(notif.type).toBe("field_signal");
  });

  it("builds call intel notification", () => {
    const feedback = {
      id: "fb-test2",
      delivery_id: "",
      source: "call_intel" as const,
      value: "SOC 2 compliance gap",
      raw_text: "SOC 2 compliance gap",
      rep_id: "",
      deal_name: "Acme Corp",
      timestamp: "2025-01-15T10:00:00Z",
    };

    const notif = buildFieldSignalNotification(feedback);

    expect(notif.text).toContain("Call intel");
    expect(notif.text).toContain("Acme Corp");
    expect(notif.text).toContain("SOC 2 compliance gap");
  });

  it("includes delivery context when provided", () => {
    const feedback = {
      id: "fb-test3",
      delivery_id: "del-test1",
      source: "reply" as const,
      value: "field_signal",
      raw_text: "Need more ROI data",
      rep_id: "U12345",
      deal_name: "",
      timestamp: "2025-01-15T10:00:00Z",
    };

    const delivery = populatedFeedbackLog.deliveries[0];
    const notif = buildFieldSignalNotification(feedback, delivery);

    expect(notif.text).toContain(delivery.deal_name);
    expect(notif.text).toContain(delivery.deal_stage);
  });
});
