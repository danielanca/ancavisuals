import React from "react";
import FreePhotoboothContracts from "./FreePhotoboothContracts";
import { FREE_PHOTOBOOTH_PROMO_ON, remainingSlotsNote, type FreePhotoboothOffer } from "./freePhotoboothOffer";
import type { PackageSelection } from "./PriceConfigurator";
import { EXTRAS, SERVICES, eventByKey } from "../../../shared/pricing/eventConfigurator";

// One block for everything in the wedding package (owner audit, 2026-10-26). It mirrors the
// configurator above (owner, 2026-10-26): a booth or the album shows up only once it is ticked there.
export const DEFAULT_SELECTION: PackageSelection = { event: "nunta", service: "foto_video", extras: [], albumVariant: 0 };

export type PackageItem = { label: string; gift?: boolean };

const SERVICE_LINE = {
  foto_video: "Fotograf + videograf — echipa completă, tot ce se întâmplă",
  foto: "Fotograf — tot ce se întâmplă, în fotografii",
  video: "Videograf — tot ce se întâmplă, filmat 4K",
} as const;

export function packageItems(selection: PackageSelection): PackageItem[] {
  const event = eventByKey(selection.event);
  const photos = selection.service !== "video";
  const film = selection.service !== "foto";
  const items: PackageItem[] = [{ label: SERVICE_LINE[selection.service] }];
  items.push({ label: photos ? "Galerie online privată, cu fotografiile editate" : "Galerie online privată" });
  if (film) items.push({ label: "Film lung + highlight, filmate 4K" });
  if (event?.included.includes("QR Code Moments")) items.push({ label: "QR Code Moments: pozele invitaților, într-un singur album" });
  for (const key of event?.extras ?? []) {
    if (!selection.extras.includes(key)) continue;
    const extra = EXTRAS[key];
    const variant = extra.variants?.[selection.albumVariant] ?? extra.variants?.[0];
    items.push({ label: `${extra.label}${variant ? ` · ${variant.label}` : ""}: ${extra.note[0].toLocaleLowerCase("ro-RO")}${extra.note.slice(1)}`, gift: key === selection.gift });
  }
  return items;
}

interface WeddingPackageIncludesProps {
  offer: FreePhotoboothOffer;
  now: number;
  referral: boolean;
  whatsappHref: string;
  /** What is ticked in the configurator; the default wedding package before it reports. */
  selection?: PackageSelection;
  onCta?: () => void;
}

export default function WeddingPackageIncludes({ offer, now, referral, whatsappHref, selection = DEFAULT_SELECTION, onCta }: WeddingPackageIncludesProps) {
  const serviceLabel = SERVICES.find((s) => s.key === selection.service)?.label ?? "Foto + Video";
  return (
    <section data-track-section="ce primiti" className="border-t border-neutral-200 bg-white px-6 py-16 text-neutral-950 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">{eventByKey(selection.event)?.label ?? "Nuntă"}</p>
        <h2 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">Ce primiți în pachetul {serviceLabel}</h2>

        <ul className="mt-8 border-t border-neutral-200">
          {packageItems(selection).map((item) => (
            <li key={item.label} className="flex items-start gap-3 border-b border-neutral-200 py-4 text-base">
              <span aria-hidden="true" className="mt-0.5 font-semibold">✓</span>
              <span>
                {item.label}
                {item.gift && (
                  <span className="mt-1 block text-sm">
                    <strong className="font-semibold">Cadou</strong>{" "}
                    <span className="text-neutral-600">· {referral ? "Ați venit prin recomandare." : remainingSlotsNote(offer)}</span>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCta}
          className="mt-8 inline-flex w-full items-center justify-center gap-2.5 bg-neutral-950 px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-black sm:w-auto"
        >
          Întrebați-ne despre pachet
          <span aria-hidden="true">→</span>
        </a>

        {!referral && FREE_PHOTOBOOTH_PROMO_ON && <FreePhotoboothContracts offer={offer} now={now} />}
      </div>
    </section>
  );
}
