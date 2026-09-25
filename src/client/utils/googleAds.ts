// Google Ads conversion tracking (AW-10941123412, account "Dinlubire.ro" —
// AncaVisuals campaigns run through this same account). Each flow below calls
// its matching conversion action — creating a distinct conversion action
// requires setting it up in the Google Ads UI first (Tools > Conversions),
// which isn't something code alone can provision.
const AW_LEAD_SEND_TO = "AW-10941123412/zzijCI7gxv4cENSWkeEo"; // "Trimiteți un formular de client potențial"
const AW_CONTACT_CLICK_SEND_TO = "AW-10941123412/MCYICIjAx_4cENSWkeEo"; // "Persoană de contact" (WhatsApp / phone reveal clicks)
const AW_PHONE_REVEAL_MICRO_SEND_TO = "AW-10941123412/vnzKCPrJ0oQdENSWkeEo"; // "Telefon afișat (micro)"
const AW_AVAILABILITY_MICRO_SEND_TO = "AW-10941123412/UaLJCL7Y0oQdENSWkeEo"; // "Verificare disponibilitate (micro)"

function newTransactionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Enhanced conversions: gtag.js hashes plain-text email/phone client-side
// before sending, so we only need to normalize format here, never hash
// ourselves. Romanian numbers only — returns null for anything we can't
// confidently turn into E.164 (better to omit than send a malformed value).
function toE164Ro(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+40${digits.slice(1)}`;
  if (digits.startsWith("40")) return `+${digits}`;
  return null;
}

function buildUserData(params: { phone?: string; email?: string }): Record<string, string> | undefined {
  const userData: Record<string, string> = {};
  const phone = params.phone ? toE164Ro(params.phone) : null;
  if (phone) userData.phone_number = phone;
  if (params.email?.trim()) userData.email = params.email.trim().toLowerCase();
  return Object.keys(userData).length > 0 ? userData : undefined;
}

function fireAdsConversion(
  sendTo: string,
  params: { value?: number; currency?: string; phone?: string; email?: string }
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", {
    send_to: sendTo,
    value: params.value ?? 1.0,
    currency: params.currency ?? "RON",
    transaction_id: newTransactionId(),
    user_data: buildUserData(params),
  });
}

export function fireAdsLeadConversion(
  params: { value?: number; currency?: string; phone?: string; email?: string } = {}
): void {
  fireAdsConversion(AW_LEAD_SEND_TO, params);
}

// WhatsApp click / "Afișează numărul" reveal — a lighter-weight signal than a
// full lead submission, so it's its own conversion action rather than reusing
// fireAdsLeadConversion.
export function fireAdsContactClickConversion(params: { phone?: string } = {}): void {
  fireAdsConversion(AW_CONTACT_CLICK_SEND_TO, params);
}

export function fireAdsPhoneRevealMicroConversion(): void {
  fireAdsConversion(AW_PHONE_REVEAL_MICRO_SEND_TO, { value: 0 });
}

export function fireAdsAvailabilityMicroConversion(): void {
  fireAdsConversion(AW_AVAILABILITY_MICRO_SEND_TO, { value: 0 });
}
