const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";

export interface SendSmsOptions {
  to: string;
  body: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

export function normalizeRomanianPhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[^\d+]/g, "");
  if (!compact) return null;

  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    return digits.length >= 7 ? `+${digits}` : null;
  }

  const digits = compact.replace(/\D/g, "");
  if (digits.length < 7) return null;

  if (digits.startsWith("40") && digits.length >= 11) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length >= 10) {
    return `+40${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `+40${digits}`;
  }

  return `+${digits}`;
}

export async function sendSms({ to, body }: SendSmsOptions): Promise<void> {
  if (!isSmsConfigured()) {
    throw new Error("SMS nu este configurat pe server.");
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const payload = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
    Body: body,
  });
  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SMS trimitere eșuată (${response.status}): ${errorBody.slice(0, 200)}`);
  }
}
