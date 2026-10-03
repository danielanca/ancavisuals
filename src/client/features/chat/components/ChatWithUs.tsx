import React, { useEffect, useRef, useState } from "react";
import { loadTidio, openLiveChat, subscribeToLiveChatStatus, type LiveChatStatus } from "./LiveChat";
import { sendLiveEvent } from "../../../utils/liveEvent";

const WHATSAPP_URL = "https://wa.me/40745469907?text=" + encodeURIComponent("Bună! Am o întrebare.");

const STYLES = `
  @keyframes cwuSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
  @keyframes cwuPing { 0% { transform: scale(1); opacity: .7; } 80%, 100% { transform: scale(2.4); opacity: 0; } }
  @keyframes cwuDot { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
  @keyframes cwuBubble { 0%, 18% { opacity: 0; transform: translateY(6px) scale(.96); } 26%, 100% { opacity: 1; transform: none; } }
  @keyframes cwuTyping { 0%, 16% { opacity: 1; } 22%, 100% { opacity: 0; } }
  .cwu-border { transform: translate(-50%, -50%); animation: cwuSpin 6s linear infinite; }
  .cwu-ping { animation: cwuPing 1.8s cubic-bezier(0,0,.2,1) infinite; }
  .cwu-dot { animation: cwuDot 1.2s ease-in-out infinite; }
  .cwu-typing { animation: cwuTyping 9s ease infinite; }
  .cwu-bubble { animation: cwuBubble 9s ease infinite; }
  @media (prefers-reduced-motion: reduce) {
    .cwu-border, .cwu-ping, .cwu-dot { animation: none; }
    .cwu-typing { display: none; }
    .cwu-bubble { animation: none; opacity: 1; }
  }
`;

/** "Povestiți-ne despre ziua voastră" — end-of-page invitation that opens the Tidio chat (its own launcher is hidden). */
export default function ChatWithUs() {
  // Tidio's operator status (online when the Tidio app on the phone is active). Tidio is
  // loaded hidden only when this card is about to scroll into view — not with the page —
  // and its window opens only on click. Until Tidio answers, the card shows "online".
  const [status, setStatus] = useState<LiveChatStatus | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => subscribeToLiveChatStatus(setStatus), []);
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
  const isOffline = status === "offline";

  const [opening, setOpening] = useState(false);
  const startChat = () => {
    sendLiveEvent("chat_opened", { label: "Conversați cu noi" });
    setOpening(true);
    // Tidio loads on this click; never leave the button stuck if its script is blocked.
    const fallback = window.setTimeout(() => setOpening(false), 10_000);
    openLiveChat().finally(() => {
      window.clearTimeout(fallback);
      setOpening(false);
    });
  };

  return (
    <section ref={sectionRef} className="bg-neutral-950 px-4 py-16 sm:py-20" aria-labelledby="cwu-title">
      <style>{STYLES}</style>
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl p-[1.5px]">
        {/* Rotating gold/green light running around the card edge */}
        <div className="cwu-border pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[max(160%,900px)] bg-[conic-gradient(from_0deg,transparent_0deg,#c9a96e_60deg,transparent_120deg,transparent_180deg,#22c55e_240deg,transparent_300deg)] opacity-70" />

        <div className="relative grid gap-8 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-black px-6 py-9 sm:grid-cols-[1fr_auto] sm:items-center sm:px-10 sm:py-11">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#c9a96e]/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#a8823f] font-serif text-lg font-semibold text-neutral-950 shadow-lg shadow-[#c9a96e]/20">AV</div>
                <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5">
                  {!isOffline && <span className="cwu-ping absolute inline-flex h-full w-full rounded-full bg-green-400" />}
                  <span className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-neutral-950 ${isOffline ? "bg-neutral-500" : "bg-green-500"}`} />
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Echipa Anca Visuals</p>
                <p className={`flex items-center gap-1.5 text-xs font-medium ${isOffline ? "text-neutral-400" : "text-green-400"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-neutral-500" : "bg-green-400"}`} />
                  {isOffline ? "Suntem offline" : "Suntem online"}
                </p>
              </div>
            </div>

            <h2 id="cwu-title" className="mt-6 text-3xl font-light leading-tight text-white sm:text-4xl">
              Povestiți-ne despre <span className="bg-gradient-to-r from-[#e8c97a] to-[#c9a96e] bg-clip-text font-normal text-transparent">ziua voastră</span>
            </h2>
            <p className="mt-2 text-sm text-neutral-400 sm:text-base">
              {isOffline
                ? "Lăsați-ne un mesaj — vă răspundem imediat ce revenim online."
                : "Vă răspundem acum — de obicei în câteva minute."}
            </p>

            {/* Mini chat preview: typing dots, then the greeting */}
            <div className="relative mt-6 h-11">
              <div className="cwu-typing absolute left-0 top-0 inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-neutral-800 px-4 py-3">
                <span className="cwu-dot h-1.5 w-1.5 rounded-full bg-neutral-300" />
                <span className="cwu-dot h-1.5 w-1.5 rounded-full bg-neutral-300" style={{ animationDelay: "150ms" }} />
                <span className="cwu-dot h-1.5 w-1.5 rounded-full bg-neutral-300" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="cwu-bubble absolute left-0 top-0 rounded-2xl rounded-bl-sm bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100">
                Bună! 👋 Cu ce vă putem ajuta?
              </p>
            </div>
          </div>

          <div className="relative flex flex-col gap-3 sm:min-w-[220px]">
            <button
              type="button"
              onClick={startChat}
              disabled={opening}
              aria-busy={opening}
              className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#e8c97a] to-[#c9a96e] px-6 py-4 text-sm font-semibold text-neutral-950 shadow-lg shadow-[#c9a96e]/25 transition-transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#c9a96e]/30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {opening ? "Se deschide chatul…" : "Scrie-ne acum"}
              {!opening && <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>}
            </button>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-6 py-3 text-sm text-neutral-300 transition-colors hover:border-green-500/50 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-500" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
              sau pe WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
