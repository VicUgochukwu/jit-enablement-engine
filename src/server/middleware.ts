/**
 * Express middleware — request logging and error handling.
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Request logger — logs method, path, and status code.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

/**
 * Global error handler — catches unhandled errors in routes.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error server-side (never sent to client)
  console.error("[ERROR]", err.message);

  // Never expose error details to clients — even in development.
  // Error messages can contain file paths, env var names, or stack traces
  // that reveal server internals.
  res.status(500).json({
    error: "Internal server error",
  });
}
