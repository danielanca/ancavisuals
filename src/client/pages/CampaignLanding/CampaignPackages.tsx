import React from "react";
import type { CampaignPackage } from "./CampaignLandingPage";

interface CampaignPackagesProps {
  packages: CampaignPackage[];
  waLink: (text: string) => string;
  onWhatsAppClick: (position: string) => void;
}

type ParsedPrice = { amount: number; currency: string };

// "950 EURO", "1200 euro", "1.450 €" → { amount, currency: "€" }. Anything else
// (ex. "la cerere") stays as typed in admin.
function parsePrice(raw: string | undefined): ParsedPrice | null {
  const m = /^\s*([\d.\s]+)\s*(euro|eur|€|lei|ron)?\s*$/i.exec(raw ?? "");
  if (!m) return null;
  const amount = Number(m[1].replace(/[.\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (m[2] ?? "€").toLowerCase();
  return { amount, currency: unit === "lei" || unit === "ron" ? "lei" : "€" };
}

const formatAmount = (n: number) => n.toLocaleString("ro-RO");

// "PREMIUM - Fotocabină + Videobooth 360" → tier "PREMIUM", subtitle "Fotocabină + Videobooth 360".
function splitName(name: string): { tier: string; subtitle: string } {
  const [tier, ...rest] = name.split(/\s+[-–—]\s+/);
  return { tier: tier.trim(), subtitle: rest.join(" – ").trim() };
}

// Admin data mixes "FOTOCABINA" with "Album foto"; long all-caps words read as
// shouting next to the rest, so "VIDEOBOOTH 360" → "Videobooth 360" (QR, 4K stay).
const softenCaps = (text: string) =>
  text.replace(/\p{Lu}{5,}/gu, (w) => w[0] + w.slice(1).toLocaleLowerCase("ro-RO"));

const normalizeFeature = (f: string) => f.trim().toLocaleLowerCase("ro-RO");

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.527 5.845L.057 23.455a.5.5 0 00.614.614l5.61-1.47A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.497-5.21-1.367l-.374-.218-3.878 1.016 1.016-3.878-.218-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// "STANDARD" → "Standard" (names are typed in caps in admin; the serif reads better in title case).
const titleCase = (text: string) =>
  text === text.toLocaleUpperCase("ro-RO") ? text[0] + text.slice(1).toLocaleLowerCase("ro-RO") : text;

export default function CampaignPackages({ packages, waLink, onWhatsAppClick }: CampaignPackagesProps) {
  return (
    <section id="pachete" className="bg-[#fbf8f2] px-6 py-24 text-[#2f2a24] sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.35em] text-[#8a6d3b]">
            <span className="h-px w-10 bg-[#b8955a]/60" />
            Pachete
            <span className="h-px w-10 bg-[#b8955a]/60" />
          </p>
          <h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">
            Alege experiența care vi se <em className="text-[#8a6d3b]">potrivește</em>.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#5c5348] sm:text-base">
            Fiecare pachet este un punct de plecare. Ne adaptăm poveștii, ritmului și oamenilor care fac ziua voastră unică.
          </p>
        </div>

        <div className={`grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-6 ${packages.length >= 3 ? "lg:grid-cols-3" : "md:mx-auto md:max-w-4xl"}`}>
          {packages.map((pkg, index) => {
            const { tier, subtitle } = splitName(pkg.name);
            const name = titleCase(tier);
            const price = parsePrice(pkg.price);
            const oldPrice = pkg.oldPrice?.trim() ? parsePrice(pkg.oldPrice) : null;
            const hasDiscount = Boolean(pkg.oldPrice?.trim());
            // "Cel mai ales" always sits in the middle (owner's call); with an even count
            // there is no middle, so the admin "highlighted" flag decides.
            const dark = packages.length % 2 === 1 && packages.length >= 3
              ? index === (packages.length - 1) / 2
              : Boolean(pkg.highlighted);

            // Features the previous tier already has are muted, the ones this tier adds
            // are in gold — the difference between packages is visible at a glance.
            const prev = index > 0 ? packages[index - 1] : null;
            const prevFeatures = new Set((prev?.features ?? []).map(normalizeFeature));
            const isNew = (f: string) => Boolean(prev) && !prevFeatures.has(normalizeFeature(f));
            const features = [...pkg.features.filter((f) => !isNew(f)), ...pkg.features.filter(isNew)];
            const prevName = prev ? titleCase(splitName(prev.name).tier) : "";

            const prevPrice = prev ? parsePrice(prev.price) : null;
            const delta =
              price && prevPrice && price.currency === prevPrice.currency && price.amount > prevPrice.amount
                ? price.amount - prevPrice.amount
                : null;

            const message = `Bună! Am văzut oferta voastră și mă interesează pachetul ${pkg.name} (${pkg.price}). Aș dori mai multe detalii.`;
            const muted = dark ? "text-[#f6f2ea]/60" : "text-[#5c5348]";
            const gold = dark ? "text-[#d9b97a]" : "text-[#8a6d3b]";
            const rule = dark ? "border-[#f6f2ea]/10" : "border-[#2f2a24]/10";

            return (
              <article
                key={pkg.id}
                className={`relative p-2.5 ${
                  dark
                    ? "bg-[#2f2a24] text-[#f6f2ea] shadow-[0_40px_80px_-30px_rgba(47,42,36,0.6)] lg:-my-6"
                    : "bg-white shadow-[0_20px_50px_-30px_rgba(47,42,36,0.35)] ring-1 ring-[#2f2a24]/[0.06]"
                }`}
              >
                {dark && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-[#b8955a] px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white">
                    Cel mai ales
                  </span>
                )}
                <div className={`flex h-full flex-col border px-6 py-10 text-center sm:px-8 ${dark ? "border-[#d9b97a]/30 lg:py-16" : "border-[#b8955a]/30"}`}>
                  <p className={`text-[10px] uppercase tracking-[0.4em] ${gold}`}>Pachetul {ROMAN[index] ?? index + 1}</p>
                  <h3 className="mt-4 font-serif text-4xl leading-none">{name}</h3>
                  <p className={`mt-2 min-h-[1.5rem] font-serif text-base italic ${gold}`}>{subtitle ? softenCaps(subtitle) : ""}</p>

                  <div className="mx-auto my-6 flex items-center gap-2" aria-hidden="true">
                    <span className={`h-px w-8 ${dark ? "bg-[#d9b97a]/50" : "bg-[#b8955a]/60"}`} />
                    <span className={`h-1.5 w-1.5 rotate-45 ${dark ? "bg-[#d9b97a]" : "bg-[#b8955a]"}`} />
                    <span className={`h-px w-8 ${dark ? "bg-[#d9b97a]/50" : "bg-[#b8955a]/60"}`} />
                  </div>

                  {hasDiscount && (
                    <p className="mb-1 flex items-center justify-center gap-2 text-sm">
                      <span className={`line-through decoration-red-500/70 decoration-2 ${muted}`}>
                        {oldPrice ? `${formatAmount(oldPrice.amount)} ${oldPrice.currency}` : pkg.oldPrice}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Preț redus</span>
                    </p>
                  )}
                  {price ? (
                    <p className="flex items-baseline justify-center gap-1.5">
                      <span className="font-serif text-5xl leading-none sm:text-6xl">{formatAmount(price.amount)}</span>
                      <span className={`font-serif text-2xl ${muted}`}>{price.currency}</span>
                    </p>
                  ) : (
                    <p className="font-serif text-4xl">{pkg.price}</p>
                  )}
                  <p className={`mt-3 min-h-[1rem] text-[10px] uppercase tracking-[0.25em] ${muted}`}>
                    {delta ? `+ ${formatAmount(delta)} ${price!.currency} față de ${prevName}` : " "}
                  </p>

                  <ul className={`mt-8 flex-1 border-t ${rule}`}>
                    {features.map((feature, featureIndex) => (
                      <li key={featureIndex} className={`border-b py-3 text-sm ${rule} ${isNew(feature) ? `font-semibold ${gold}` : prev ? muted : ""}`}>
                        {isNew(feature) && <span className="mr-1.5">+</span>}
                        {softenCaps(feature)}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={waLink(message)}
                    onClick={() => onWhatsAppClick("package")}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-9 flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
                      dark
                        ? "bg-[#b8955a] text-white hover:bg-[#c9a66b]"
                        : "border border-[#2f2a24]/80 text-[#2f2a24] hover:bg-[#2f2a24] hover:text-[#fbf8f2]"
                    }`}
                  >
                    <WhatsAppIcon />
                    Alege {name}
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-20 text-center">
          <p className="mx-auto max-w-sm font-serif text-2xl leading-snug text-[#2f2a24] [text-wrap:balance] sm:max-w-none sm:text-3xl">
            {/* nbsp keeps "cu alta." together — no lone word on its own line on phones. */}
            Nicio nuntă nu seamănă cu{"\u00a0"}alta.
            <br />
            <em className="text-[#8a6d3b]">De ce ar semăna pachetele?</em>
          </p>
          <a
            href={waLink("Bună! Am văzut oferta voastră și aș vrea un pachet croit pe măsura nunții noastre.")}
            onClick={() => onWhatsAppClick("package_custom")}
            target="_blank"
            rel="noreferrer"
            className="group mt-7 inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border border-[#8a6d3b]/50 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a6d3b] transition-colors hover:border-[#2f2a24] hover:bg-[#2f2a24] hover:text-[#fbf8f2] sm:px-8 sm:text-xs sm:tracking-[0.2em]"
          >
            Hai să-l croim pe măsura voastră
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
