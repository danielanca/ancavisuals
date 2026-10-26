import React, { useEffect, useRef, useState } from "react";
import { loadTidio, openLiveChat } from "./LiveChat";
import { sendLiveEvent } from "../../../utils/liveEvent";
import { greetingFor, subscribeToVisitorPlan, type VisitorPlan } from "../configuratorOffer";

const WHATSAPP_DEFAULT_TEXT = "Bună! Am o întrebare.";
const whatsappUrl = (text: string) => "https://wa.me/40745469907?text=" + encodeURIComponent(text.trim() || WHATSAPP_DEFAULT_TEXT);
const WHATSAPP_URL = whatsappUrl("");

const STYLES = `
  @keyframes cwuDot { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
  @keyframes cwuIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes cwuScan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  .cwu-dot { animation: cwuDot 1.2s ease-in-out infinite; }
  .cwu-in { animation: cwuIn .3s ease-out both; }
  .cwu-scan { animation: cwuScan 5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .cwu-dot, .cwu-scan, .cwu-in { animation: none; }
  }
`;

// Our second message, "typed" a few seconds after the greeting. *text* is bold, as in WhatsApp.
const QR_MOMENTS_MESSAGE = "Și veți primi *gratuit* QR Code Moments 🎁 Invitații scanează codul, fac poze și video cu telefonul și le încarcă într-o galerie la care aveți acces doar voi 📸";

// The chat plays out like a real one once on screen: typing → greeting → typing → QR Moments.
const CHAT_STEPS_MS = [900, 2500, 1800];

/** WhatsApp's "typing…" bubble. */
function TypingBubble() {
  return (
    <div className="cwu-in ml-2 inline-flex w-fit items-center gap-1 rounded-lg rounded-tl-none px-3 py-3 shadow-sm" style={{ background: WA.bubbleIn }} aria-label="scrie…">
      <span className="cwu-dot h-1.5 w-1.5 rounded-full" style={{ background: WA.muted }} />
      <span className="cwu-dot h-1.5 w-1.5 rounded-full" style={{ background: WA.muted, animationDelay: "150ms" }} />
      <span className="cwu-dot h-1.5 w-1.5 rounded-full" style={{ background: WA.muted, animationDelay: "300ms" }} />
    </div>
  );
}

/** An incoming bubble; only the first of a series has the little tail, as in WhatsApp. No clock time: it is a fixed message, not a live one. */
function IncomingBubble({ text, tail }: { text: string; tail: boolean }) {
  return (
    <div className={`cwu-in relative ml-2 max-w-[92%] rounded-lg px-3 pb-2 pt-2 shadow-sm ${tail ? "rounded-tl-none" : ""}`} style={{ background: WA.bubbleIn }}>
      {tail && <span aria-hidden="true" className="absolute -left-2 top-0 h-0 w-0 border-r-[8px] border-t-[8px] border-r-transparent border-t-transparent" style={{ borderRightColor: WA.bubbleIn }} />}
      <p className="text-sm leading-normal" style={{ color: WA.text }}>{withWhatsAppBold(text)}</p>
    </div>
  );
}

// The emoji panel of the fake WhatsApp field — the ones couples actually send us.
const EMOJIS = ["😊", "😍", "🥰", "😂", "🙏", "👋", "❤️", "💍", "👰", "🤵", "💐", "🎉", "🥂", "📸", "🎥", "✨", "👍", "🙂", "😉", "🤗", "💕", "📅", "⛪", "🎶"];

const WHATSAPP_LOGO_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z";

// WhatsApp's own colours (green header, beige wallpaper, white bubbles), so the preview reads
// as a WhatsApp conversation at a glance.
const WA = {
  header: "#008069",
  wallpaper: "#efeae2",
  bubbleIn: "#ffffff",
  text: "#111b21",
  muted: "#667781",
  footer: "#f0f2f5",
  input: "#ffffff",
  green: "#00a884",
};
// WhatsApp's faint doodle wallpaper, approximated with a dotted pattern.
const WA_WALLPAPER = `radial-gradient(circle at 1px 1px, rgba(0,0,0,.06) 1px, transparent 0) 0 0 / 14px 14px, ${WA.wallpaper}`;

/**
 * What the visitor types in the fake WhatsApp field goes to the real WhatsApp, already filled in.
 * Sending is a real wa.me link (Enter clicks it too), so it is tracked like every other WhatsApp
 * click — live panel, contact email and the Google Ads contact conversion.
 */
function WhatsAppPreview() {
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  // The offer built in the price configurator (if any), added to the message only on request.
  // Read after mount (localStorage), so the server and the first render agree on the default greeting.
  const [plan, setPlan] = useState<VisitorPlan>({ offer: null, checkedDate: null });
  const [offerAdded, setOfferAdded] = useState(false);
  useEffect(() => subscribeToVisitorPlan(setPlan), []);
  const offer = plan.offer?.text ?? null;

  // 0 typing → 1 greeting → 2 typing → 3 QR Moments, started when the box scrolls into view.
  // Without IntersectionObserver (tests, old browsers) or with reduced motion: everything at once.
  const [chatStep, setChatStep] = useState(0);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = conversationRef.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!node || reduced || typeof IntersectionObserver === "undefined") { setChatStep(3); return; }
    const timers: number[] = [];
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      let at = 0;
      CHAT_STEPS_MS.forEach((delay, index) => {
        at += delay;
        timers.push(window.setTimeout(() => setChatStep(index + 1), at));
      });
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => { observer.disconnect(); timers.forEach((timer) => window.clearTimeout(timer)); };
  }, []);
  const withOffer = offerAdded && offer;
  const message = withOffer ? `${draft.trim() || "Bună!"}\n\n${offer}` : draft;
  const sendRef = useRef<HTMLAnchorElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Puts the emoji where the cursor is (end of the text if the field was never focused). */
  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };
  return (
    <>
    <div className="-mx-4 mt-8 w-[calc(100%+2rem)] overflow-hidden shadow-2xl sm:rounded-lg shadow-black/60 sm:mx-0 sm:w-full sm:max-w-sm" style={{ background: WA_WALLPAPER }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 text-white" style={{ background: WA.header }}>
        {/* Dani & Estera, cropped from the "Despre noi" photo (public/images, 160px, ~7 KB). */}
        <span className="relative shrink-0">
          <img
            src="/images/dani-estera-avatar.webp"
            alt="Dani și Estera"
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 rounded-full object-cover"
          />
          {/* WhatsApp badge on the profile photo */}
          <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#25d366] ring-2 ring-[#008069]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d={WHATSAPP_LOGO_PATH} /></svg>
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">Anca Visuals</p>
          <p className="text-xs leading-tight text-white/80">Estera și Dani</p>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-white" role="img" aria-label="WhatsApp">
          <path d={WHATSAPP_LOGO_PATH} />
        </svg>
      </div>

      {/* Conversation */}
      {/* Tall like a phone screen, with the empty space a real conversation has below the message. */}
      <div ref={conversationRef} className="h-[26rem] overflow-hidden px-3 pb-4 pt-4 sm:h-[30rem]">
        <div className="flex flex-col gap-2" aria-live="polite">
          {chatStep >= 1 && <IncomingBubble text={greetingFor(plan)} tail />}
          {chatStep >= 3 && <IncomingBubble text={QR_MOMENTS_MESSAGE} tail={false} />}
          {(chatStep === 0 || chatStep === 2) && <TypingBubble />}
        </div>
      </div>

      {/* The configured offer, shown like a quoted message above the field once added */}
      {withOffer && (
        <div className="flex items-start gap-2 px-2 pt-2" style={{ background: WA.footer }}>
          <div className="min-w-0 flex-1 rounded-md border-l-4 bg-white px-3 py-2" style={{ borderColor: WA.green }}>
            <p className="text-xs font-medium" style={{ color: WA.green }}>Oferta configurată</p>
            <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs" style={{ color: WA.muted }}>{offer}</p>
          </div>
          <button
            type="button"
            onClick={() => setOfferAdded(false)}
            aria-label="Scoate oferta din mesaj"
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm hover:bg-black/5"
            style={{ color: WA.muted }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input bar — sends the typed text to the real WhatsApp */}
      <form
        className="relative flex items-center gap-2 px-2 py-2"
        style={{ background: WA.footer }}
        onSubmit={(event) => { event.preventDefault(); sendRef.current?.click(); }}
      >
        {emojiOpen && (
          <div role="dialog" aria-label="Emoji" className="absolute bottom-full left-2 right-2 mb-1 grid grid-cols-8 gap-0.5 rounded-lg bg-white p-2 shadow-xl">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                aria-label={`Adaugă ${emoji}`}
                className="flex h-9 items-center justify-center rounded text-xl hover:bg-[#f0f2f5]"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-1 items-center gap-2 rounded-full px-3 py-2" style={{ background: WA.input, color: WA.muted }}>
          <button
            type="button"
            onClick={() => setEmojiOpen((open) => !open)}
            aria-label="Emoji"
            aria-expanded={emojiOpen}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#f0f2f5]"
            style={{ color: emojiOpen ? WA.green : WA.muted }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.3 1.5 3.5 1.5 3.5-1.5 3.5-1.5" /><path d="M9 9.5h.01M15 9.5h.01" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Scrie un mesaj"
            aria-label="Mesaj pe WhatsApp"
            enterKeyHint="send"
            maxLength={1000}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#667781]"
            style={{ color: WA.text }}
          />
        </div>
        <a
          ref={sendRef}
          href={whatsappUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Trimite pe WhatsApp"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          style={{ background: WA.green }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4 20.85 12.9a1 1 0 0 0 0-1.8L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
          </svg>
        </a>
      </form>
    </div>
    {offer && !offerAdded && (
      <button
        type="button"
        onClick={() => { setOfferAdded(true); sendLiveEvent("chat_offer_added", { label: "Adaugă în mesaj oferta configurată" }); }}
        className="mt-2 inline-flex w-full max-w-sm items-center justify-center gap-2 border border-[#25d366]/60 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[#25d366] transition-colors hover:bg-[#25d366] hover:text-black"
      >
        <span aria-hidden="true">＋</span> Adaugă în mesaj oferta configurată
      </button>
    )}
    </>
  );
}

/** WhatsApp formatting: *text* is bold. */
function withWhatsAppBold(text: string): React.ReactNode[] {
  return text.split(/\*([^*]+)\*/).map((part, index) => (index % 2 ? <strong key={index} className="font-semibold">{part}</strong> : part));
}

/** Viewfinder corner marks — the card reads as a camera frame. */
function FrameCorners() {
  const corner = "pointer-events-none absolute h-4 w-4 border-white/70";
  return (
    <>
      <span aria-hidden="true" className={`${corner} -left-px -top-px border-l border-t`} />
      <span aria-hidden="true" className={`${corner} -right-px -top-px border-r border-t`} />
      <span aria-hidden="true" className={`${corner} -bottom-px -left-px border-b border-l`} />
      <span aria-hidden="true" className={`${corner} -bottom-px -right-px border-b border-r`} />
    </>
  );
}

/** "Povestiți-ne despre ziua voastră" — end-of-page invitation that opens the Tidio chat (its own launcher is hidden). */
export default function ChatWithUs() {
  // No "online" status: Tidio is loaded hidden only when this card is about to scroll into
  // view — not with the page — and its window opens only on click.
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadTidio();
      observer.disconnect();
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const [opening, setOpening] = useState(false);
  // On the owner's own device (admin / localhost) Tidio stays off; say so instead of a dead button.
  const [blockedHere, setBlockedHere] = useState(false);
  const startChat = (force = false) => {
    if (!force) sendLiveEvent("chat_opened", { label: "Conversați cu noi" });
    setOpening(true);
    setBlockedHere(false);
    // Tidio loads on this click; never leave the button stuck if its script is blocked.
    const fallback = window.setTimeout(() => setOpening(false), 10_000);
    openLiveChat({ force })
      .then((opened) => setBlockedHere(!opened))
      .finally(() => {
        window.clearTimeout(fallback);
        setOpening(false);
      });
  };

  return (
    <section ref={sectionRef} className="bg-neutral-950 px-2 py-16 sm:px-4 sm:py-20" aria-labelledby="cwu-title">
      <style>{STYLES}</style>
      {/* Album look (/media): square, black and white, thin uppercase type, no gold or rounded corners. */}
      <div className="relative mx-auto max-w-4xl border border-white/15 bg-black">
        <FrameCorners />
        {/* A thin light passing along the top edge */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="cwu-scan h-full w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        </div>

        <div className="grid gap-10 px-4 py-10 sm:grid-cols-[1fr_auto] sm:items-center sm:px-12 sm:py-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border border-white/40 text-xs font-light tracking-[0.2em] text-white">AV</div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white">Echipa Anca Visuals</p>
            </div>

            {/* Same type as "Video scurt" on /media: thin uppercase, one font; the second line only steps down in tone. */}
            <h2 id="cwu-title" className="mt-8 text-xl font-extralight uppercase leading-relaxed tracking-[0.18em] text-white sm:text-2xl">
              Povestiți-ne
              <span className="block text-neutral-400">despre ziua voastră</span>
            </h2>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
              [ Scrie-ne aici sau pe WhatsApp. Estera sau Dani îți răspund de obicei în 1–2 ore. ]
            </p>

            {/* Mini chat preview in WhatsApp's dark look: typing dots, then the greeting. */}
            <WhatsAppPreview />
          </div>

          <div className="flex flex-col gap-3 sm:min-w-[240px]">
            <button
              type="button"
              onClick={() => startChat()}
              disabled={opening}
              aria-busy={opening}
              className="group inline-flex items-center justify-center gap-3 border border-white bg-white px-6 py-4 text-xs font-medium uppercase tracking-[0.2em] text-black transition-colors hover:bg-transparent hover:text-white disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                <path d="M21 15V3H3v18l4-4h14z" />
              </svg>
              {opening ? "Se deschide chatul…" : "Scrie-ne acum"}
              {!opening && <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>}
            </button>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 border border-white/20 px-6 py-3.5 text-xs uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-white hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-500" aria-hidden="true">
                <path d={WHATSAPP_LOGO_PATH} />
              </svg>
              sau pe WhatsApp
            </a>
            {blockedHere && (
              <p role="status" className="max-w-[240px] text-[11px] leading-relaxed text-neutral-400">
                Ești pe dispozitivul de admin: chatul nu se încarcă aici, ca să nu apari ca vizitator în Tidio.{" "}
                <button type="button" onClick={() => startChat(true)} className="text-white underline underline-offset-2 hover:no-underline">
                  Deschide oricum
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
