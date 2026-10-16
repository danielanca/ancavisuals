/** wa.me link for a client phone; Romanian local numbers (07…) get the 40 prefix.
 *  `message` pre-fills the chat. */
export function whatsappUrl(phone: string, message?: string): string | null {
  const compact = phone.trim().replace(/[^\d+]/g, "");
  if (!compact) return null;

  const digits = compact.replace(/^\+/, "");
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  if (digits.startsWith("0") && digits.length >= 10) return `https://wa.me/40${digits.slice(1)}${text}`;
  if (digits.startsWith("40") && digits.length >= 11) return `https://wa.me/${digits}${text}`;
  if (digits.length >= 7) return `https://wa.me/${digits}${text}`;
  return null;
}
