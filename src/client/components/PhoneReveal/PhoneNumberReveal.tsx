import { useState, useCallback, type CSSProperties, type ReactNode } from "react";
import { isBrowser } from "../../utils/functions";
import { getLandingMeta } from "../../utils/sessionAttribution";
import { sendTriggerEmail } from "../../utils/triggers";

interface PhoneNumberRevealProps {
  /** Digits only, e.g. "0745469907" — used to build the tel: link. */
  phone: string;
  /** Formatted number shown once revealed, e.g. "0745 469 907". Defaults to `phone`. */
  display?: string;
  /** Label shown before the number once revealed, e.g. "Sună — ". */
  revealedPrefix?: string;
  /** Text shown on the hidden-state button. */
  buttonLabel?: string;
  /** Where on the site this instance lives — shows up in the notification email. */
  context: string;
  className?: string;
  style?: CSSProperties;
  icon?: ReactNode;
  onRevealed?: () => void;
}

function toTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("0")) return `tel:+40${digits.slice(1)}`;
  return `tel:${digits}`;
}

function notifyPhoneReveal(context: string) {
  if (!isBrowser()) return;
  const landing = getLandingMeta();
  sendTriggerEmail({
    typeEvent: `📞 Număr afișat — ${context}`,
    url: window.location.pathname + window.location.search,
    isNewVisitor: true,
    utmSource: landing?.utmSource,
    utmMedium: landing?.utmMedium,
    utmCampaign: landing?.utmCampaign,
    landingPath: landing?.landingPath,
    keyword: landing?.utmTerm ?? landing?.keyword,
  }).catch(() => {});
}

export default function PhoneNumberReveal({
  phone,
  display,
  revealedPrefix = "",
  buttonLabel = "AFIȘEAZĂ NUMĂRUL",
  context,
  className,
  style,
  icon,
  onRevealed,
}: PhoneNumberRevealProps) {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    notifyPhoneReveal(context);
    onRevealed?.();
  }, [context, onRevealed]);

  if (!revealed) {
    return (
      <button type="button" className={className} style={style} onClick={handleReveal}>
        {icon}
        {buttonLabel}
      </button>
    );
  }

  return (
    <a href={toTelHref(phone)} className={className} style={style}>
      {icon}
      {revealedPrefix}
      {display ?? phone}
    </a>
  );
}
