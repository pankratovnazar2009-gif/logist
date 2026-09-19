import { getEnv } from "./env";

/** Единая точка отправки SMS; провайдер выбирается через SMS_PROVIDER=smsapi|twilio. */
export async function sendSms(toPhone: string, message: string): Promise<void> {
  if (getEnv().SMS_PROVIDER === "twilio") {
    await sendViaTwilio(toPhone, message);
  } else {
    await sendViaSmsapi(toPhone, message);
  }
}

async function sendViaSmsapi(toPhone: string, message: string): Promise<void> {
  const env = getEnv();
  if (!env.SMSAPI_TOKEN) throw new Error("SMSAPI_TOKEN is not configured");

  const body = new URLSearchParams({ to: toPhone, message, format: "json" });
  if (env.SMSAPI_SENDER_NAME) body.set("from", env.SMSAPI_SENDER_NAME);

  const res = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SMSAPI_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await res.json()) as { error?: number; message?: string };
  if (!res.ok || data.error) {
    throw new Error(`SMSAPI.pl error: ${data.message ?? res.statusText}`);
  }
}

async function sendViaTwilio(toPhone: string, message: string): Promise<void> {
  const env = getEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    throw new Error("Twilio credentials are not configured");
  }

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const body = new URLSearchParams({ To: toPhone, From: env.TWILIO_FROM_NUMBER, Body: message });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Twilio error: ${await res.text()}`);
  }
}
