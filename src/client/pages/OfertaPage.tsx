import React, { useEffect, useState, useRef } from "react";
import { remoteAddress } from "../utils/address";
import { useParams } from "react-router-dom";
import CampaignLandingPage, { type CampaignPage } from "./CampaignLanding/CampaignLandingPage";
import type { OfferPackage } from "../../shared/offers/offerServices";
import { measureOaiq } from "../utils/oaiq";

const INITIAL_PHOTO_COUNT = 12;

type OfferServiceSection = {
  id: string;
  label: string;
  description: string;
  basePrice: string;
  assets: Array<{
    id: string;
    kind: "image" | "video";
    url: string;
    label: string;
    displayUrl?: string;
  }>;
};

type Offer = {
  id: string;
  slug: string;
  clientName: string;
  title: string;
  description: string;
  pdfUrl: string;
  price: string;
  packageName: string;
  packages?: OfferPackage[];
  validUntil: string;
  selectedServices: string[];
  serviceSections: OfferServiceSection[];
};

function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateString;
  }
}

function viewSessionKey(slug: string) {
  return `oferta_viewed_${slug}`;
}

function packageIncludes(value: string): string[] {
  return value
    .split(/\r?\n|•|;/)
    .map(item => item.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

function packageIncludeItems(pkg: OfferPackage): string[] {
  if (Array.isArray(pkg.includedItems)) {
    return pkg.includedItems
      .filter(item => item.included && item.label.trim())
      .map(item => item.label.trim());
  }
  return packageIncludes(pkg.includes);
}

export default function OfertaPage() {
  const { slug = "" } = useParams<{ slug?: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [campaign, setCampaign] = useState<CampaignPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [expandedPhotoServices, setExpandedPhotoServices] = useState<Set<string>>(() => new Set());
  const viewTracked = useRef(false);
  const assetUrl = (asset: OfferServiceSection["assets"][number]) => asset.displayUrl ?? asset.url;

  function showAllPhotos(serviceId: string) {
    setExpandedPhotoServices(current => {
      const next = new Set(current);
      next.add(serviceId);
      return next;
    });
  }

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    fetch(`/api/oferte/${slug}`)
      .then(async (response) => {
        if (!response.ok) {
          // Not a client offer — check if it's a campaign landing page
          return fetch(`/api/campaign/public/${slug}`).then(async (campaignResponse) => {
            if (!campaignResponse.ok) { setNotFound(true); return; }
            const data = await campaignResponse.json() as CampaignPage;
            setCampaign(data);
          });
        }
        const data = await response.json() as Offer;
        setOffer(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Track view once per browser session — offer
  useEffect(() => {
    if (!offer || viewTracked.current) return;
    const sessionKey = viewSessionKey(slug);
    if (sessionStorage.getItem(sessionKey)) return;
    viewTracked.current = true;
    sessionStorage.setItem(sessionKey, "1");
    fetch(`/api/oferte/${slug}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageUrl: window.location.href, referrer: document.referrer }),
    }).catch(() => {});
  }, [offer, slug]);

  // Track view once per browser session — campaign
  useEffect(() => {
    if (!campaign || viewTracked.current) return;
    const sessionKey = viewSessionKey(`campaign_${slug}`);
    if (sessionStorage.getItem(sessionKey)) return;
    viewTracked.current = true;
    sessionStorage.setItem(sessionKey, "1");
    fetch(`/api/campaign/${slug}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageUrl: window.location.href, referrer: document.referrer }),
    }).catch(() => {});
  }, [campaign, slug]);

  const handleDownload = async () => {
    if (!offer?.pdfUrl || downloading) return;
    setDownloading(true);

    // Notify server
    fetch(`/api/oferte/${slug}/download`, { method: "POST" }).catch(() => {});

    // Trigger download
    try {
      const response = await fetch(offer.pdfUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `oferta-ancavisuals-${slug}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(offer.pdfUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (campaign) return <CampaignLandingPage page={campaign} />;

  if (notFound || !offer) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-violet-400/60 text-xs tracking-widest uppercase mb-4">Ancavisuals</p>
        <h1 className="text-2xl font-light text-white mb-3">Oferta nu a fost găsită</h1>
        <p className="text-neutral-500 text-sm">Linkul poate fi incorect sau oferta a expirat.</p>
        <a href={remoteAddress} className="mt-8 text-xs text-neutral-600 hover:text-neutral-400 transition-colors underline underline-offset-2">
          ancavisuals.ro
        </a>
      </div>
    );
  }

  const packages = Array.isArray(offer.packages) ? offer.packages : [];

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Background accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-5 py-16 sm:py-24">

        {/* Header */}
        <div className="mb-12 sm:mb-16">
          <p className="text-violet-400/70 text-[11px] tracking-[0.25em] uppercase mb-6">
            Ancavisuals · Ofertă personalizată
          </p>

          {offer.clientName && (
            <p className="text-neutral-400 text-lg font-light mb-2">
              Bună, <span className="text-white">{offer.clientName}</span>,
            </p>
          )}

          <h1 className="text-3xl sm:text-4xl font-light leading-snug text-white mb-4">
            {offer.title || "Ofertă Ancavisuals"}
          </h1>

          {offer.validUntil && (
            <div className="inline-flex items-center gap-1.5 bg-amber-900/20 border border-amber-800/40 text-amber-400 text-xs px-3 py-1.5 rounded-full">
              <span>⏳</span>
              <span>Valabilă până la {formatDate(offer.validUntil)}</span>
            </div>
          )}
        </div>

        {offer.serviceSections?.length > 0 && (
          <div className="mb-10">
            <p className="text-neutral-500 text-xs uppercase tracking-[0.2em] mb-4">Servicii incluse</p>
            <div className="flex flex-wrap gap-2">
              {offer.serviceSections.map(service => (
                <span
                  key={service.id}
                  className="rounded-full border border-violet-800/60 bg-violet-900/20 px-3 py-1.5 text-xs text-violet-200"
                >
                  {service.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {offer.description && (
          <div className="mb-10">
            <div className="bg-neutral-900/50 border border-neutral-800/60 rounded-2xl p-6">
              {offer.description.split("\n").map((line, index) => (
                line.trim() === ""
                  ? <br key={index} />
                  : <p key={index} className="text-neutral-300 text-sm leading-relaxed mb-3 last:mb-0">{line}</p>
              ))}
            </div>
          </div>
        )}

        {offer.serviceSections?.length > 0 && (
          <div className="mb-12">
            <div className="mb-5">
              <p className="text-neutral-500 text-xs uppercase tracking-[0.2em] mb-2">Preview vizual</p>
              <h2 className="text-white text-2xl font-light">Serviciile pe care le-am pregatit pentru tine</h2>
            </div>

            <div className="space-y-8">
              {offer.serviceSections.map(service => {
                const imageAssets = service.assets.filter(asset => asset.kind !== "video");
                const videoAssets = service.assets.filter(asset => asset.kind === "video");
                const showAll = expandedPhotoServices.has(service.id);
                const visibleImages = showAll ? imageAssets : imageAssets.slice(0, INITIAL_PHOTO_COUNT);

                return (
                <section key={service.id} className="rounded-[28px] border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-white text-2xl sm:text-3xl font-light tracking-tight">{service.label}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">{service.description}</p>
                    </div>
                  </div>

                  {visibleImages.length > 0 && (
                    <div className="mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4">
                      {visibleImages.map((asset, index) => (
                        <div key={asset.id} className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                          <img
                            src={assetUrl(asset)}
                            alt={`${service.label} Ancavisuals ${index + 1}`}
                            loading="lazy"
                            className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {!showAll && imageAssets.length > INITIAL_PHOTO_COUNT && (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => showAllPhotos(service.id)}
                        className="rounded-full border border-violet-700/70 bg-violet-900/20 px-5 py-2.5 text-xs font-semibold tracking-[0.16em] text-violet-200 transition-colors hover:border-violet-500 hover:bg-violet-900/40"
                      >
                        MAI MULTE POZE
                      </button>
                    </div>
                  )}

                  {videoAssets.length > 0 && (
                    <div className={`${visibleImages.length > 0 || imageAssets.length > 0 ? "mt-6" : "mt-5"} space-y-4`}>
                      {videoAssets.map(asset => (
                        <div key={asset.id} className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                          <div className="aspect-video w-full bg-black">
                            <video
                              src={assetUrl(asset)}
                              controls
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-contain"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                );
              })}
            </div>
          </div>
        )}

        {/* Full package list stays at the end, immediately before the CTAs. */}
        {packages.length > 0 && (
          <div className="mb-12 space-y-4">
            <div className="mb-5">
              <p className="text-violet-400/80 text-[11px] uppercase tracking-[0.2em] mb-2">Prețuri</p>
              <h2 className="text-2xl sm:text-3xl font-light text-white">Alege pachetul potrivit pentru voi</h2>
            </div>

            {packages.map((pkg, index) => {
              const includes = packageIncludeItems(pkg);
              return (
                <article key={pkg.id || `package-${index}`} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-7">
                  <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0">
                      {pkg.name && (
                        <p className="text-violet-400/80 text-[11px] uppercase tracking-[0.2em] mb-2">{pkg.name}</p>
                      )}
                      <h2 className="text-2xl sm:text-3xl font-light leading-tight text-white">
                        {pkg.headline || pkg.name || `Pachet ${index + 1}`}
                      </h2>
                      {pkg.subheadline && (
                        <p className="mt-2 text-sm leading-relaxed text-neutral-300">{pkg.subheadline}</p>
                      )}
                      {includes.length > 0 && (
                        <div className="mt-5 space-y-2">
                          <p className="text-neutral-500 text-xs uppercase tracking-[0.16em]">Include</p>
                          {includes.map(item => (
                            <p key={item} className="flex items-start gap-2 text-sm text-neutral-300">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-violet-400/70 bg-violet-500/20 text-xs font-bold text-violet-200">✓</span>
                              <span>{item}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    {pkg.price && (
                      <div className="sm:min-w-[140px] sm:border-l sm:border-neutral-800 sm:pl-6 sm:text-right">
                        <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Preț</p>
                        <p className="text-3xl font-light text-white">{pkg.price}</p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {packages.length === 0 && (offer.packageName || offer.price) && (
          <div className="mb-12 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {offer.packageName && (
                <>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Pachet</p>
                  <p className="text-white text-lg font-medium">{offer.packageName}</p>
                </>
              )}
            </div>
            {offer.price && (
              <div className="text-right flex-shrink-0">
                <p className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Preț</p>
                <p className="text-3xl font-light text-white">{offer.price}</p>
              </div>
            )}
          </div>
        )}

        {/* Download CTA */}
        {offer.pdfUrl && (
          <div className="mb-12">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:text-violet-500 text-white font-medium px-8 py-4 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-violet-900/30"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Se descarcă...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descarcă oferta PDF
                </>
              )}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-neutral-800/60 pt-10">
          <p className="text-neutral-600 text-sm leading-relaxed mb-6">
            Ai întrebări sau vrei să discutăm detalii? Nu ezita să mă contactezi.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="tel:+40745469907"
              onClick={() => measureOaiq("lead_created", { type: "customer_action" })}
              className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white px-5 py-3 rounded-xl text-sm transition-colors"
            >
              <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              Sună
            </a>
            <a
              href="https://www.instagram.com/ancavisuals"
              onClick={() => measureOaiq("lead_created", { type: "customer_action" })}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white px-5 py-3 rounded-xl text-sm transition-colors"
            >
              <svg className="w-4 h-4 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              Instagram
            </a>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-neutral-700 text-xs">© Ancavisuals · ancavisuals.ro</p>
        </div>
      </div>
    </div>
  );
}
