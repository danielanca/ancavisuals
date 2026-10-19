/*
 * Purpose: every client action of the album in one place, right under the title — so nobody
 * sends album picks on WhatsApp or makes their own share link because they never found the
 * buttons further down. Each tile carries a data-onboarding target for the mandatory tour.
 */

/**
 * One accent per action, all from the same family (dark tinted card + bright accent button),
 * so each card reads as its own, independent thing. Full class strings so Tailwind keeps them.
 */
const TONES = {
  sky: { card: "border-[#0c4a6e] bg-[#06141d] hover:border-[#38bdf8]", title: "text-[#7dd3fc]", button: "bg-[#0284c7]" },
  violet: { card: "border-[#4c1d95] bg-[#110b1f] hover:border-[#a78bfa]", title: "text-[#c4b5fd]", button: "bg-[#7c3aed]" },
  teal: { card: "border-[#115e59] bg-[#061716] hover:border-[#2dd4bf]", title: "text-[#5eead4]", button: "bg-[#0d9488]" },
  rose: { card: "border-[#881337] bg-[#1c0a10] hover:border-[#fb7185]", title: "text-[#fda4af]", button: "bg-[#e11d48]" },
  fuchsia: { card: "border-[#701a75] bg-[#1a0a1b] hover:border-[#e879f9]", title: "text-[#f0abfc]", button: "bg-[#c026d3]" },
} as const;

type Action = {
  id: string;
  tone?: keyof typeof TONES;
  /** Label of the action's own button ("Alege", "Descarcă"…). */
  cta?: string;
  emoji: string;
  title: string;
  hint: string;
  onClick: () => void;
  done?: boolean;
  /** Green AncaVisuals "share" tile (same greens as the share page) with a short how-to. */
  share?: boolean;
  steps?: string[];
};

type Props = {
  hasPhotos: boolean;
  printCount: number;
  hasDeliveryAddress: boolean;
  zipReady: boolean;
  /** No ZIP yet: the tile asks the photographer for it instead of downloading. */
  zipRequest: "idle" | "sending" | "sent" | "error";
  isCouple: boolean;
  onPickAlbumPhotos: () => void;
  onDelivery: () => void;
  onShare: () => void;
  onDownloadAll: () => void;
  onRequestZip: () => void;
  onUpdates: () => void;
  onSentPhotos: () => void;
  onTutorial: () => void;
};

export default function AlbumActionHub(props: Props) {
  const actions: Action[] = [];
  if (props.hasPhotos) {
    actions.push({
      id: "hub-print",
      emoji: "🖼️",
      title: "Alege pozele pentru album",
      hint: props.printCount > 0 ? `${props.printCount} alese · le poți schimba` : "Bifezi aici pozele pentru albumul tipărit",
      onClick: props.onPickAlbumPhotos,
      done: props.printCount > 0,
      tone: "sky",
      cta: props.printCount > 0 ? "Modifică" : "Alege",
    });
    actions.push({
      id: "hub-share",
      emoji: "📤",
      title: "Trimite poze invitaților",
      hint: "🔒 Invitații primesc un link anonim, doar cu pozele alese — fără acces la albumul vostru.",
      steps: [
        "Bifezi pozele",
        "Apeși butonul verde care pulsează și verifici pozele alese",
        "Confirmi: se deschide WhatsApp (sau SMS), alegi oamenii",
      ],
      share: true,
      onClick: props.onShare,
    });
  }
  actions.push({
    id: "hub-delivery",
    emoji: "📦",
    title: "Adresa de livrare",
    hint: props.hasDeliveryAddress ? "Completată · vezi sau modifică" : "Unde trimitem albumul și stick-ul",
    onClick: props.onDelivery,
    done: props.hasDeliveryAddress,
    tone: "violet",
    cta: props.hasDeliveryAddress ? "Vezi" : "Completează",
  });
  if (props.hasPhotos) {
    const zipHint = {
      idle: "Arhiva nu e gata încă · apasă ca să anunți fotograful",
      sending: "Se trimite…",
      sent: "Fotograful a fost anunțat · revino puțin mai târziu",
      error: "Nu am putut trimite · încearcă din nou",
    }[props.zipRequest];
    actions.push({
      id: "hub-download",
      emoji: "⬇️",
      title: props.zipReady ? "Descarcă toate pozele" : "Cere toate pozele (ZIP)",
      hint: props.zipReady ? "Arhivă ZIP, calitate completă" : zipHint,
      onClick: props.zipReady ? props.onDownloadAll : props.onRequestZip,
      done: !props.zipReady && props.zipRequest === "sent",
      tone: "teal",
      cta: props.zipReady ? "Descarcă" : props.zipRequest === "sent" ? "Anunțat" : "Cere",
    });
  }
  if (props.isCouple) {
    actions.push({ id: "hub-sent", emoji: "💌", title: "Pozele trimise de voi", hint: "Cui ați trimis și cine le-a deschis", onClick: props.onSentPhotos, tone: "fuchsia", cta: "Vezi" });
  }
  actions.push({ id: "hub-updates", emoji: "🔔", title: "Noutăți & abonare", hint: "Estimări și anunț când apar poze noi", onClick: props.onUpdates, tone: "rose", cta: "Vezi" });

  const share = actions.find((action) => action.share);
  const rows = actions.filter((action) => !action.share);

  return (
    <nav data-onboarding="hub" aria-label="Ce poți face în album" className="my-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Ce poți face aici</p>
        <button type="button" onClick={props.onTutorial} className="text-xs text-neutral-400 underline underline-offset-4 hover:text-white">
          ❓ Cum funcționează
        </button>
      </div>

      {/* Mobile: one compact list (no tall empty tiles), album photos first, then the share card.
          Wider screens: 2–3 columns with the share card on top spanning the full width, so its
          steps read on one line each and no grid cell is left empty next to it. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.slice(0, 1).map(renderRow)}
        {share && (
          <button
            type="button"
            data-onboarding={share.id}
            onClick={share.onClick}
            className="flex flex-col gap-2 border border-[#22c55e] sm:-order-1 bg-gradient-to-br from-[#0f2a18] to-[#06150c] p-3 text-left transition-colors hover:border-[#4ade80] sm:col-span-2 lg:col-span-3"
          >
            <span className="flex w-full items-center gap-3">
              <span className="text-xl" aria-hidden>{share.emoji}</span>
              <span className="min-w-0 flex-1 text-[15px] font-bold leading-tight text-[#4ade80]">{share.title}</span>
              <span className="shrink-0 bg-[#22c55e] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Începe →</span>
            </span>
            {share.steps && (
              <ol className="grid gap-1 text-[12px] leading-snug text-[#d1fae5] sm:grid-cols-3 sm:gap-3">
                {share.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center bg-[#166534] text-[10px] font-bold text-[#4ade80]">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
            <span className="text-[11px] leading-snug text-[#86efac]">{share.hint}</span>
          </button>
        )}
        {rows.slice(1).map(renderRow)}
      </div>
    </nav>
  );
}

function renderRow(action: Action) {
  const tone = TONES[action.tone ?? "sky"];
  return (
    <button
      key={action.id}
      type="button"
      data-onboarding={action.id}
      onClick={action.onClick}
      className={`flex items-center gap-3 border px-3 py-2.5 text-left transition-colors ${tone.card}`}
    >
      <span className="text-xl" aria-hidden>{action.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className={`flex items-center gap-1.5 text-sm font-semibold leading-tight ${tone.title}`}>
          {action.title}
          {action.done && <span className="flex h-4 w-4 shrink-0 items-center justify-center bg-green-900 text-[10px] font-bold text-green-300" aria-label="Făcut">✓</span>}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-neutral-400">{action.hint}</span>
      </span>
      {action.cta && (
        <span className={`shrink-0 px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white ${tone.button}`} aria-hidden>
          {action.cta} →
        </span>
      )}
    </button>
  );
}

