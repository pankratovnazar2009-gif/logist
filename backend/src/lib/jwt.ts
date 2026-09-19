import jwt from "jsonwebtoken";
import { env } from "./env";

export interface AppTokenPayload {
  userId: string;
}

export function signAppToken(payload: AppTokenPayload): string {
  return jwt.sign(payload, env.APP_JWT_SECRET, { expiresIn: env.APP_JWT_TTL as jwt.SignOptions["expiresIn"] });
}

export function verifyAppToken(token: string): AppTokenPayload {
  return jwt.verify(token, env.APP_JWT_SECRET) as AppTokenPayload;
}
