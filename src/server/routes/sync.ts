/**
 * Sync routes — receive KB and rep directory updates from the MCP server.
 *
 * When a PMM manages their KB locally via Claude Code, the MCP server's
 * data layer pushes updates here so the Railway-deployed webhook server
 * stays in sync. Authenticated with a shared secret (SYNC_SECRET).
 *
 * Routes:
 *   PUT /api/kb             — overwrite the knowledge base
 *   PUT /api/rep-directory   — overwrite the rep directory
 */

import { Router } from "express";
import type { Config } from "../../shared/config.js";
import { writeFileSync } from "fs";
import { ensureDirForPath } from "../../shared/data.js";

export function createSyncRouter(config: Config): Router {
  const router = Router();

  // ── Auth middleware ────────────────────────────────────────
  router.use((req, res, next) => {
    if (!config.syncSecret) {
      res.status(503).json({
        error: "Sync is not configured — set SYNC_SECRET on the server",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }

    const token = authHeader.slice(7); // "Bearer " is 7 chars
    if (token !== config.syncSecret) {
      res.status(403).json({ error: "Invalid sync secret" });
      return;
    }

    next();
  });

  // ── PUT /api/kb ───────────────────────────────────────────
  router.put("/kb", (req, res) => {
    const body = req.body;

    // Basic shape validation — must look like a KB
    if (!body || !Array.isArray(body.case_studies) || !body._meta) {
      res.status(400).json({
        error: "Invalid knowledge base format — expected case_studies array and _meta object",
      });
      return;
    }

    try {
      ensureDirForPath(config.kbPath);
      writeFileSync(config.kbPath, JSON.stringify(body, null, 2));

      console.log(
        `[JIT] Sync: KB updated (${body._meta.entry_count || 0} entries)`
      );

      res.status(200).json({
        synced: true,
        file: "knowledge-base.json",
        entries: body._meta.entry_count || 0,
      });
    } catch (err) {
      console.error("[JIT] Sync: KB write failed:", (err as Error).message);
      res.status(500).json({ error: "Failed to write knowledge base" });
    }
  });

  // ── PUT /api/rep-directory ────────────────────────────────
  router.put("/rep-directory", (req, res) => {
    const body = req.body;

    // Basic shape validation — must look like a rep directory
    if (!body || !Array.isArray(body.reps) || !body._meta) {
      res.status(400).json({
        error: "Invalid rep directory format — expected reps array and _meta object",
      });
      return;
    }

    try {
      ensureDirForPath(config.repDirectoryPath);
      writeFileSync(
        config.repDirectoryPath,
        JSON.stringify(body, null, 2)
      );

      console.log(
        `[JIT] Sync: Rep directory updated (${body._meta.total_reps || 0} reps)`
      );

      res.status(200).json({
        synced: true,
        file: "rep-directory.json",
        reps: body._meta.total_reps || 0,
      });
    } catch (err) {
      console.error(
        "[JIT] Sync: Rep directory write failed:",
        (err as Error).message
      );
      res.status(500).json({ error: "Failed to write rep directory" });
    }
  });

  return router;
}
