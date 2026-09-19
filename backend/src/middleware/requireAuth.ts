import type { NextFunction, Request, Response } from "express";
import { verifyAppToken } from "../lib/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    const payload = verifyAppToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function requireInternalKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-internal-key"];
  if (key !== process.env.INTERNAL_API_KEY) return res.status(401).json({ error: "invalid_internal_key" });
  next();
}
