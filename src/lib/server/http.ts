import jwt from "jsonwebtoken";
import { getEnv } from "./env";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function signAppToken(userId: string): string {
  const env = getEnv();
  return jwt.sign({ userId }, env.APP_JWT_SECRET, { expiresIn: env.APP_JWT_TTL as jwt.SignOptions["expiresIn"] });
}

/** Возвращает id пользователя из Bearer-токена или null, если токена нет / он невалиден. */
export function authUserId(req: Request): string | null {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getEnv().APP_JWT_SECRET) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

/** Внутренние вызовы (Python-парсер) авторизуются общим секретом, а не пользовательским JWT. */
export function isInternalRequest(req: Request): boolean {
  return req.headers.get("x-internal-key") === getEnv().INTERNAL_API_KEY;
}

export const unauthorized = () => json({ error: "unauthorized" }, 401);
