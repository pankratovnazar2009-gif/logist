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
  GUS_API_KEY: z.string().default("abcde12345abcde12345"),
  GUS_ENV: z.enum(["test", "prod"]).default("test"),
  APP_BASE_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Валидируется лениво, при первом обращении — чтобы сборка не падала, пока переменные не заданы. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  cached = parsed.data;
  return cached;
}

/** Публичный адрес приложения для ссылок в SMS: явная переменная → домен Vercel → localhost. */
export function appBaseUrl(): string {
  const env = getEnv();
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
