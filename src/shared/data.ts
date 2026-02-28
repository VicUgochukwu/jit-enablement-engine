/**
 * Data access layer — read/write knowledge base and feedback log.
 *
 * Both the MCP server and webhook server import from here.
 * Files are local JSON — no GitHub, no databases.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type {
  KnowledgeBase,
  FeedbackLog,
  DeliveryEntry,
  FeedbackEntry,
  RepDirectory,
  RepEntry,
} from "./types.js";

// ============================================================
// KNOWLEDGE BASE
// ============================================================

const EMPTY_KB: KnowledgeBase = {
  case_studies: [],
  competitor_positioning: [],
  objection_library: [],
  methodology: null,
  _meta: {
    last_updated: null,
    version: "1.0",
    entry_count: 0,
    configured: false,
  },
};

export function readKB(path: string): KnowledgeBase {
  if (!existsSync(path)) {
    ensureDir(path);
    writeFileSync(path, JSON.stringify(EMPTY_KB, null, 2));
    return structuredClone(EMPTY_KB);
  }
  const kb = JSON.parse(readFileSync(path, "utf-8")) as KnowledgeBase;

  // Backwards compatibility: add fields that older KB files may not have
  if (!kb.objection_library) kb.objection_library = [];
  for (const cs of kb.case_studies) {
    if (!cs.resources) cs.resources = [];
  }
  for (const cp of kb.competitor_positioning) {
    if (!cp.resources) cp.resources = [];
  }

  return kb;
}

export function writeKB(path: string, kb: KnowledgeBase): void {
  // Ensure objection_library exists for backwards compatibility
  if (!kb.objection_library) kb.objection_library = [];

  const totalEntries =
    kb.case_studies.length +
    kb.competitor_positioning.length +
    kb.objection_library.length +
    (kb.methodology ? 1 : 0);

  kb._meta.entry_count = totalEntries;
  kb._meta.configured = totalEntries > 0;
  kb._meta.last_updated = new Date().toISOString();

  ensureDir(path);
  writeFileSync(path, JSON.stringify(kb, null, 2));

  // Push to remote if sync is enabled (fire-and-forget)
  pushSync("/api/kb", kb).catch(() => {});
}

// ============================================================
// FEEDBACK LOG
// ============================================================

const EMPTY_LOG: FeedbackLog = {
  deliveries: [],
  feedback: [],
  _meta: {
    last_updated: null,
    version: "1.0",
    total_deliveries: 0,
    total_feedback: 0,
  },
};

export function readFeedbackLog(path: string): FeedbackLog {
  if (!existsSync(path)) {
    ensureDir(path);
    writeFileSync(path, JSON.stringify(EMPTY_LOG, null, 2));
    return structuredClone(EMPTY_LOG);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeFeedbackLog(path: string, log: FeedbackLog): void {
  log._meta.total_deliveries = log.deliveries.length;
  log._meta.total_feedback = log.feedback.length;
  log._meta.last_updated = new Date().toISOString();

  ensureDir(path);
  writeFileSync(path, JSON.stringify(log, null, 2));
}

export function appendDelivery(
  path: string,
  entry: DeliveryEntry
): void {
  const log = readFeedbackLog(path);
  log.deliveries.push(entry);
  writeFeedbackLog(path, log);
}

export function appendFeedback(
  path: string,
  entry: FeedbackEntry
): void {
  const log = readFeedbackLog(path);
  log.feedback.push(entry);
  writeFeedbackLog(path, log);
}

// ============================================================
// REP DIRECTORY
// ============================================================

const EMPTY_REP_DIR: RepDirectory = {
  reps: [],
  _meta: {
    last_updated: null,
    version: "1.0",
    total_reps: 0,
  },
};

export function readRepDirectory(path: string): RepDirectory {
  if (!existsSync(path)) {
    ensureDir(path);
    writeFileSync(path, JSON.stringify(EMPTY_REP_DIR, null, 2));
    return structuredClone(EMPTY_REP_DIR);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function writeRepDirectory(path: string, dir: RepDirectory): void {
  dir._meta.total_reps = dir.reps.length;
  dir._meta.last_updated = new Date().toISOString();

  ensureDir(path);
  writeFileSync(path, JSON.stringify(dir, null, 2));

  // Push to remote if sync is enabled (fire-and-forget)
  pushSync("/api/rep-directory", dir).catch(() => {});
}

/**
 * Look up a rep by email (case-insensitive).
 */
export function findRepByEmail(
  path: string,
  email: string
): RepEntry | null {
  const dir = readRepDirectory(path);
  const target = email.toLowerCase();
  return dir.reps.find((r) => r.email.toLowerCase() === target) || null;
}

/**
 * Look up a rep by Telegram chat ID.
 */
export function findRepByTelegramChatId(
  path: string,
  chatId: string
): RepEntry | null {
  const dir = readRepDirectory(path);
  return dir.reps.find((r) => r.telegram_chat_id === chatId) || null;
}

/**
 * Add or update a rep in the directory.
 * If the email already exists, updates the existing entry.
 */
export function upsertRep(path: string, rep: RepEntry): void {
  const dir = readRepDirectory(path);
  const idx = dir.reps.findIndex(
    (r) => r.email.toLowerCase() === rep.email.toLowerCase()
  );

  if (idx >= 0) {
    // Merge — preserve fields the new entry doesn't have
    dir.reps[idx] = {
      ...dir.reps[idx],
      ...rep,
      // Keep non-empty values from existing entry if new entry is blank
      slack_id: rep.slack_id || dir.reps[idx].slack_id,
      telegram_chat_id:
        rep.telegram_chat_id || dir.reps[idx].telegram_chat_id,
    };
  } else {
    dir.reps.push(rep);
  }

  writeRepDirectory(path, dir);
}

/**
 * Remove a rep by email.
 */
export function removeRep(path: string, email: string): boolean {
  const dir = readRepDirectory(path);
  const before = dir.reps.length;
  dir.reps = dir.reps.filter(
    (r) => r.email.toLowerCase() !== email.toLowerCase()
  );
  if (dir.reps.length < before) {
    writeRepDirectory(path, dir);
    return true;
  }
  return false;
}

// ============================================================
// REMOTE SYNC — push local changes to Railway webhook server
// ============================================================

/**
 * Configuration for remote sync. Set via environment variables.
 * When SYNC_URL is set, every writeKB / writeRepDirectory call
 * also pushes the update to the remote server.
 */
let syncConfig: { url: string; secret: string } | null = null;

/**
 * Enable remote sync. Called once during MCP server startup.
 * Subsequent writeKB / writeRepDirectory calls will push to the remote.
 */
export function enableSync(url: string, secret: string): void {
  syncConfig = { url: url.replace(/\/+$/, ""), secret };
  console.log(`[JIT] Sync enabled → ${syncConfig.url}`);
}

/**
 * Push data to the remote sync endpoint.
 * Fire-and-forget — logs errors but never blocks the caller.
 */
async function pushSync(
  endpoint: string,
  data: unknown
): Promise<void> {
  if (!syncConfig) return;

  const url = `${syncConfig.url}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${syncConfig.secret}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json() as Record<string, unknown>;
      console.log(`[JIT] Sync push OK: ${endpoint} → ${JSON.stringify(result)}`);
    } else {
      const text = await response.text();
      console.error(`[JIT] Sync push failed: ${endpoint} → ${response.status} ${text}`);
    }
  } catch (err) {
    // Network error — don't crash the MCP server
    console.error(
      `[JIT] Sync push error: ${endpoint} →`,
      (err as Error).message
    );
  }
}

// ============================================================
// HELPERS
// ============================================================

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Exported version of ensureDir for use by sync routes.
 */
export function ensureDirForPath(filePath: string): void {
  ensureDir(filePath);
}
