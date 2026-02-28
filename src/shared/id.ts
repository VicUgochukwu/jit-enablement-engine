/**
 * ID generation utilities.
 *
 * Generates sequential IDs for KB entries (cs-001, cp-002)
 * and timestamp-based IDs for deliveries (del-lx3k9f).
 */

/**
 * Generate a sequential ID with a prefix.
 * Scans existing entries to find the highest number and increments.
 *
 * @example generateId("cs", [{id: "cs-001"}, {id: "cs-002"}]) → "cs-003"
 */
export function generateId(
  prefix: string,
  existing: { id: string }[]
): string {
  const maxNum = existing.reduce((max, item) => {
    const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

// Monotonic counter prevents duplicate IDs within the same millisecond.
// In practice, deliveries happen seconds apart, but this handles
// rapid test/batch scenarios safely.
let _counter = 0;

/**
 * Generate a delivery ID using timestamp base-36 encoding + counter.
 * Short, unique, sortable.
 *
 * @example generateDeliveryId() → "del-lx3k9f7-0"
 */
export function generateDeliveryId(): string {
  return `del-${Date.now().toString(36)}-${(_counter++).toString(36)}`;
}

/**
 * Generate a feedback ID using timestamp base-36 encoding + counter.
 *
 * @example generateFeedbackId() → "fb-lx3k9f7-1"
 */
export function generateFeedbackId(): string {
  return `fb-${Date.now().toString(36)}-${(_counter++).toString(36)}`;
}
