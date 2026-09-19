import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_JWT_SECRET: z.string().min(16),
  APP_JWT_TTL: z.string().default("30d"),
  INTERNAL_API_KEY: z.string().min(8),
  SMS_PROVIDER: z.enum(["smsapi", "twilio"]).default("smsapi"),
  SMSAPI_TOKEN: z.string().optional(),
  SMSAPI_SENDER_NAME: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  GUS_API_KEY: z.string().min(1),
  GUS_ENV: z.enum(["test", "prod"]).default("test"),
  PORT: z.coerce.number().default(4000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
