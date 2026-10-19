/*
 * Purpose: the "Trimite-le pe WhatsApp" / "Prin SMS" buttons — the app opens with the text and
 * the anonymous share link (/share/<random id>, no album or couple name) already written; the
 * client only picks the contacts. wa.me without a number opens WhatsApp's contact picker.
 */
export const SHARE_MESSAGE_PREFIX = "Pozele făcute de AncaVisuals:";

export function whatsappShareText(shareUrl: string): string {
  return `${SHARE_MESSAGE_PREFIX} ${shareUrl}`;
}

export function whatsappShareUrl(shareUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(whatsappShareText(shareUrl))}`;
}

/** Opens the phone's SMS app with the text ready; the client picks the recipients. */
export function smsShareUrl(shareUrl: string): string {
  return `sms:?&body=${encodeURIComponent(whatsappShareText(shareUrl))}`;
}

/**
 * SMS to one number with the text filled in. "?&body=" is read by both Android ("?body=") and
 * iPhone ("&body="), so one link works on both.
 */
export function smsShareUrlTo(phone: string, shareUrl: string): string {
  return `sms:${phone}?&body=${encodeURIComponent(whatsappShareText(shareUrl))}`;
}
