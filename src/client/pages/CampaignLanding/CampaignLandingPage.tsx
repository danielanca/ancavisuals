import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { measureOaiq } from "../../utils/oaiq";
import { getCookie } from "../../utils/functions";
import { openCookieSettings } from "../../utils/cookieConsent";
import { reportAvailabilityCheck, sendLiveEvent } from "../../utils/liveEvent";
import {
  fireAdsContactClickConversion,
  fireAdsLeadConversion,
} from "../../utils/googleAds";
import { getLandingMeta } from "../../utils/sessionAttribution";
import PhoneNumberReveal from "../../components/PhoneReveal/PhoneNumberReveal";
import { useStartingPrices } from "../../hooks/useStartingPrices";
import { startingPriceFor } from "../../../shared/pricing/startingPrices";
import PriceConfigurator, { type DatePick } from "./PriceConfigurator";
import LazySection from "./LazySection";
import SectionSkeleton from "./SectionSkeleton";
import HeroVideo from "./HeroVideo";
import { AncaVisualsPromo, CampaignPackages, CampaignVideoPlayer, GuideBook, PortfolioParallaxGallery, preloadGroup } from "./lazyParts";
import ChatWithUs from "../../features/chat/components/ChatWithUs";
import { isLiveChatConfigured } from "../../features/chat/components/LiveChat";
import { heavyPhotoNote, isHeavyPhoto } from "../../../shared/media/photoWeight";
import { whenLandingSettled } from "../../utils/whenLandingSettled";
import { stableVh } from "../../utils/stableViewport";

const MONTHS_RO = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
const MONTHS_RO_CAP = MONTHS_RO.map((m) => m[0].toUpperCase() + m.slice(1));
function formatDateRo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS_RO[Number(m[2]) - 1]} ${m[1]}`;
}
// Video-ul de hero pornește de la 0:59 și se reia tot de acolo, în buclă —
// fără ultimele HERO_VIDEO_LOOP_END_MARGIN secunde (acolo e credits-ul).
const HERO_VIDEO_LOOP_START = 59;
const HERO_VIDEO_LOOP_END_MARGIN = 6;
const daysInMonth = (year: number, monthZeroBased: number) => new Date(year, monthZeroBased + 1, 0).getDate();
const toIso = (day: number, monthZeroBased: number, year: number) =>
  `${year}-${String(monthZeroBased + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// Free wedding guide (Bunny: offers-assets/pdfs) — only on wedding campaigns.
const WEDDING_GUIDE_URL = "https://ancavisuals.b-cdn.net/offers-assets/pdfs/Ghidul-Mirilor.pdf";
const WEDDING_GUIDE_SLUGS = new Set(["olx"]);
// Price configurator (Nuntă / Botez / Majorat / Corporate) — Ads traffic also asks for christenings.
const CONFIGURATOR_SLUGS = new Set(["olx"]);
// "Verifică disponibilitatea" (#verifica-data) is switched off for now (owner, 2026-10-03):
// the configurator checks the date itself. Set to true to bring the section back.
const SHOW_AVAILABILITY_SECTION = false;
// "Pachete" is switched off for now too (owner, 2026-10-03) — the configurator shows the prices.
const SHOW_PACKAGES_SECTION = false;
const WEDDING_GUIDE_HIGHLIGHTS = [
  "În ce ordine rezervați furnizorii",
  "Actele pentru cununia civilă și religioasă",
  "Calendarul organizării, lună cu lună",
  "Desfășurătorul zilei nunții",
  "Sfaturi pentru poze și film frumoase",
  "Trusa de urgență pentru ziua nunții",
];



export interface CampaignPackage {
  id: string;
  name: string;
  price: string;
  /** Previous price, shown struck through next to `price` (a discount). */
  oldPrice?: string;
  features: string[];
  highlighted?: boolean;
}

export interface CampaignTestimonial {
  id: string;
  name: string;
  eventType: string;
  text: string;
}

export interface CampaignGalleryItem {
  url: string;
  bunnyPath: string;
  /** Known only for offer photos (sent by /api/oferte/:slug). */
  sizeBytes?: number;
}

export { isHeavyPhoto } from "../../../shared/media/photoWeight";

export interface CampaignPage {
  slug: string;
  title: string;
  subtitle: string;
  ctaText: string;
  whatsappNumber: string;
  phoneNumber: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  /** Short looping hero clip over `heroImageUrl` (offers: set in /admin/oferte) — light version… */
  heroClipUrl?: string;
  /** …and the sharper one, for good connections. */
  heroClipHdUrl?: string;
  videoUrl?: string;
  gallery: CampaignGalleryItem[];
  // Liste separate desktop/mobil, administrate din CampaignAdminPage. Campaniile
  // vechi (nemigrate) au doar `gallery` — vezi fallback-ul in randarea publica.
  galleryDesktop?: CampaignGalleryItem[];
  galleryMobile?: CampaignGalleryItem[];
  packages: CampaignPackage[];
  testimonials: CampaignTestimonial[];
  active: boolean;
  viewCount?: number;
  videoThumbnailUrl?: string;
}

interface CampaignLandingPageProps {
  page: CampaignPage;
}

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.115 1.527 5.845L.057 23.455a.5.5 0 00.614.614l5.61-1.47A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.896 0-3.673-.497-5.21-1.367l-.374-.218-3.878 1.016 1.016-3.878-.218-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function isEmbedVideoUrl(url: string) {
  return /^https?:\/\/iframe\.mediadelivery\.net\//.test(url);
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

const CONFIGURATOR_SEEN_KEY = "configurator-seen";

export default function CampaignLandingPage({ page }: CampaignLandingPageProps) {
  const whatsappLink = `https://wa.me/${page.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Bună! Am văzut oferta voastră și aș dori mai multe detalii.")}`;
  const waLink = (text: string) => `https://wa.me/${page.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  // No preselected date: a default (1st of next month) made "Verifică" one tap
  // away and filled the inbox with checks nobody actually chose.
  const [dateParts, setDateParts] = useState<DatePick>({ day: null, month: null, year: null });
  const [form, setForm] = useState({
    name: "", phone: "", eventType: "Nuntă", location: "",
    eventDate: "",
  });
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [availStatus, setAvailStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const startingPrices = useStartingPrices();
  // With the availability section off, "check the date" links go to the configurator's date step.
  const availabilityHref = SHOW_AVAILABILITY_SECTION || !CONFIGURATOR_SLUGS.has(page.slug) ? "#verifica-data" : "#configurator-data";

  // The first group of below-the-fold parts (gallery + video) downloads once the page itself is up.
  useEffect(() => {
    const start = () => preloadGroup(0);
    if (document.readyState === "complete") { start(); return; }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  // "Află prețul" shows in the hero only for someone who scrolled down, never got the
  // configurator on screen (on any visit — remembered in this browser), and came back
  // up to the top. Once shown, it stays.
  const [showPriceCta, setShowPriceCta] = useState(false);
  useEffect(() => {
    if (!CONFIGURATOR_SLUGS.has(page.slug)) return;
    const configurator = document.getElementById("configurator");
    if (!configurator || typeof IntersectionObserver === "undefined") return;
    try { if (localStorage.getItem(CONFIGURATOR_SEEN_KEY)) return; } catch { /* storage blocked: decide per visit */ }
    let wentDown = false;
    const stop = () => { observer.disconnect(); window.removeEventListener("scroll", onScroll); };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      try { localStorage.setItem(CONFIGURATOR_SEEN_KEY, "1"); } catch { /* storage blocked */ }
      stop();
    }, { threshold: 0.15 });
    const onScroll = () => {
      const top = window.scrollY;
      if (top > window.innerHeight) wentDown = true;
      else if (wentDown && top < window.innerHeight * 0.4) {
        setShowPriceCta(true);
        sendLiveEvent("configurator_cta_shown", { label: "Află prețul în 30 de secunde", meta: { source: "hero" } });
        stop();
      }
    };
    observer.observe(configurator);
    window.addEventListener("scroll", onScroll, { passive: true });
    return stop;
  }, [page.slug]);

  const todayForDate = new Date();
  const todayYear = todayForDate.getFullYear();
  const todayMonth = todayForDate.getMonth();
  const todayDay = todayForDate.getDate();

  const setDatePart = (patch: Partial<DatePick>) => {
    setDateParts((prev) => {
      const next = { ...prev, ...patch };
      // Never let the picker land on an already-passed date.
      if (next.year !== null && next.month !== null && next.year === todayYear && next.month < todayMonth) next.month = null;
      if (next.year !== null && next.month !== null && next.day !== null) {
        const maxDay = daysInMonth(next.year, next.month);
        const minDay = next.year === todayYear && next.month === todayMonth ? todayDay : 1;
        if (next.day > maxDay) next.day = maxDay;
        if (next.day < minDay) next.day = minDay;
      }
      const complete = next.day !== null && next.month !== null && next.year !== null;
      setForm((f) => ({ ...f, eventDate: complete ? toIso(next.day!, next.month!, next.year!) : "" }));
      return next;
    });
    setAvailStatus("idle");
  };

  // Not needed for the first screen (only once a date is picked): asked after the page has loaded.
  useEffect(() => whenLandingSettled(() => {
    fetch("/api/booked-dates")
      .then((r) => r.json())
      .then((d: { dates?: string[] }) => setBookedDates(d.dates ?? []))
      .catch(() => setBookedDates([]));
  }), []);
  // Real social-proof note: most recently signed contract, name masked
  // server-side. Shown once per page load after a short delay, dismissible —
  // not a repeating/fake "someone just booked" spam pattern.
  const [latestContract, setLatestContract] = useState<{ maskedName: string; signedAt: string } | null>(null);
  const [showLatestContract, setShowLatestContract] = useState(false);
  const [latestContractVisible, setLatestContractVisible] = useState(false);
  const dismissLatestContract = () => {
    setLatestContractVisible(false);
    window.setTimeout(() => setShowLatestContract(false), 300);
  };
  useEffect(() => whenLandingSettled(() => {
    fetch("/api/contracts/latest-signed")
      .then((r) => r.json())
      .then((d: { contract?: { maskedName: string; signedAt: string } | null }) => {
        if (!d.contract) return;
        setLatestContract(d.contract);
        window.setTimeout(() => {
          setShowLatestContract(true);
          window.setTimeout(() => setLatestContractVisible(true), 20);
        }, 3000);
      })
      .catch(() => {});
  }), []);
  useEffect(() => {
    if (!latestContractVisible) return;
    const timer = window.setTimeout(() => dismissLatestContract(), 10000);
    return () => window.clearTimeout(timer);
  }, [latestContractVisible]);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // Orașul vizitatorului (doar dacă e din România) — personalizează
  // "pentru nunți în {oraș} și Transilvania" fără să schimbe nimic pentru
  // vizitatorii din afara țării, care văd doar "Transilvania".
  const [visitorCity, setVisitorCity] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/campaign/geo-city")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { city?: string | null } | null) => setVisitorCity(data?.city ?? null))
      .catch(() => {});
  }, []);

  // Campanii nemigrate au doar `gallery` — o folosim ca fallback pe ambele device-uri.
  const deviceGalleryItems = isMobile
    ? (page.galleryMobile?.length ? page.galleryMobile : page.gallery)
    : (page.galleryDesktop?.length ? page.galleryDesktop : page.gallery);
  const promoAtPageEnd = page.slug === "olx";
  // Real, fixed promo deadline — does not reset per visit/session, unlike the
  // old spin-the-wheel countdown. Honest scarcity: shared end date for everyone.
  const PROMO_DEADLINE = new Date("2026-10-30T23:59:59").getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Only decides whether the promo is still on (no countdown on screen) — once a minute is enough.
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [isAdmin, setIsAdmin] = useState(() => {
    const hasAdminCookie = getCookie("av_admin") === "1";
    try {
      if (hasAdminCookie) localStorage.setItem("av_admin_device", "1");
      return hasAdminCookie || localStorage.getItem("av_admin_device") === "1";
    } catch { return hasAdminCookie; }
  });
  const [adminNotice, setAdminNotice] = useState(false);
  // Heavy photos (> 1 MB) are left out for visitors; the admin still sees them, flagged.
  // Referință stabilă (useMemo) — fără asta, ticăitul cronometrului de mai jos ar
  // recrea aceste array-uri la fiecare render, ceea ce distruge și reface în buclă
  // animația GSAP din galerie (vezi PortfolioParallaxGallery's useEffect(..., [columns])).
  const galleryItems = useMemo(
    () => (isAdmin ? deviceGalleryItems : deviceGalleryItems.filter((item) => !isHeavyPhoto(item.sizeBytes))),
    [deviceGalleryItems, isAdmin],
  );
  const galleryImageUrls = useMemo(() => galleryItems.map((item) => item.url), [galleryItems]);
  const galleryWarnings = useMemo(() => {
    const heavy = isAdmin ? galleryItems.filter((item) => isHeavyPhoto(item.sizeBytes)) : [];
    return heavy.length
      ? Object.fromEntries(heavy.map((item) => [item.url, heavyPhotoNote(item.sizeBytes!)]))
      : undefined;
  }, [galleryItems, isAdmin]);
  useEffect(() => {
    if (getCookie("av_admin") !== "1") return;
    try { localStorage.setItem("av_admin_device", "1"); } catch { /* storage indisponibil */ }
    setIsAdmin(true);
  }, []);
  const formStarted = useRef(false);
  const interactionKeys = useRef(new Set<string>());
  const notifyInteraction = (interaction: "form" | "form_action") => {
    if (isAdmin) {
      setAdminNotice(true);
      window.setTimeout(() => setAdminNotice(false), 2800);
      return;
    }
    const key = `${page.slug}:${interaction}`;
    if (interactionKeys.current.has(key)) return;
    try {
      if (sessionStorage.getItem(`av_campaign_interaction_${key}`)) return;
      sessionStorage.setItem(`av_campaign_interaction_${key}`, "1");
    } catch { /* sessionStorage poate fi indisponibil în mod privat */ }
    interactionKeys.current.add(key);
    fetch(`/api/campaign/${page.slug}/interaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interaction }),
    }).catch(() => {});
  };
  const trackFormAction = () => notifyInteraction("form_action");
  const trackFormStart = () => {
    if (formStarted.current) return;
    formStarted.current = true;
    notifyInteraction("form");
    measureOaiq("form_started", { page_path: `/oferta/${page.slug}` });
  };
  const trackGuideDownload = () => {
    sendLiveEvent("guide_downloaded", { label: "Ghidul Mirilor", meta: { file: "Ghidul-Mirilor.pdf" } });
    measureOaiq("guide_downloaded", { page_path: `/oferta/${page.slug}` });
  };
  const trackClick = (eventName: "click_whatsapp" | "click_phone", position: string) => {
    measureOaiq(eventName, { cta_position: position, page_path: `/oferta/${page.slug}` });
    // WhatsApp links are counted by the site-wide listener; the phone reveal is a button, not a link.
    if (eventName === "click_phone") fireAdsContactClickConversion();
  };

  const promoExpired = PROMO_DEADLINE - now <= 0;

  const checkAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.eventType || !form.eventDate) return;
    trackFormStart();
    trackFormAction();
    setAvailStatus("checking");
    const available = !bookedDates.includes(form.eventDate);
    window.setTimeout(() => setAvailStatus(available ? "available" : "unavailable"), 400);
    reportAvailabilityCheck(formatDateRo(form.eventDate), form.eventDate, available, form.eventType);
    measureOaiq("availability_checked", { page_path: `/oferta/${page.slug}` });
  };

  /** Saves the lead (email + Ads + live panel). The configurator sends its own name/phone/message. */
  const submitLead = async (contact: { name: string; phone: string; message?: string }, kind: "contact" | "configurator"): Promise<boolean> => {
    try {
      const landing = getLandingMeta();
      const res = await fetch(`/api/campaign/${page.slug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...contact,
          gclid: landing?.gclid,
          wbraid: landing?.wbraid,
          gbraid: landing?.gbraid,
        }),
      });
      if (res.ok) {
        measureOaiq("lead_created", { type: "customer_action", page_path: `/oferta/${page.slug}` });
        // Google Ads conversion — this is a paid-campaign landing page, so a
        // submitted lead here needs to reach Ads just like the /contact wizard does.
        fireAdsLeadConversion({ phone: contact.phone });
        // Panel live only — the lead email is sent by /api/campaign/:slug/contact.
        sendLiveEvent("form_submitted", {
          priority: "critical",
          label: kind === "configurator"
            ? "🎯 Un client și-a trimis configurația — vrea să-l suni"
            : "🎯 Un client a trimis formularul de contact — vrea să-l suni",
          meta: {
            kind,
            name: contact.name.trim(),
            phone: contact.phone.trim(),
            eventType: form.eventType,
            eventDate: form.eventDate,
            emailedElsewhere: true,
          },
        });
      }
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim()) return;
    setFormStatus("sending");
    setFormStatus((await submitLead({ name: form.name, phone: form.phone }, "contact")) ? "sent" : "error");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <style>{`@keyframes promoRainbow { 0%, 24.99% { color: #ef4444; } 25%, 49.99% { color: #facc15; } 50%, 74.99% { color: #22c55e; } 75%, 99.99% { color: #3b82f6; } } .promo-rainbow-text { animation: promoRainbow 2.8s steps(1, end) infinite; }`}</style>
      {adminNotice && <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-amber-300/40 bg-neutral-900/95 px-4 py-2 text-xs font-semibold text-amber-200 shadow-xl shadow-black/30">Ești admin — notificările sunt dezactivate.</div>}

      {showLatestContract && latestContract && (
        <div
          className={`fixed bottom-4 right-4 z-40 flex max-w-xs items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-xl shadow-black/10 transition-all duration-300 ease-out ${
            latestContractVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <span aria-hidden="true" className="text-lg">🎉</span>
          <p className="flex-1 text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">{latestContract.maskedName}</span> a semnat contractul pe {formatDateRo(latestContract.signedAt.slice(0, 10))}
          </p>
          <button
            type="button"
            onClick={dismissLatestContract}
            aria-label="Închide"
            className="text-neutral-400 transition-colors hover:text-neutral-700"
          >
            ×
          </button>
        </div>
      )}

      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="text-xs tracking-[0.28em] uppercase font-bold sm:font-medium text-white">Anca Visuals</Link>
          <a
            href={availabilityHref}
            className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold tracking-wide text-black transition-colors hover:bg-neutral-100"
          >
            Verifică disponibilitatea <ArrowIcon />
          </a>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section id="acasa" className="relative min-h-[calc(var(--stable-vh,1vh)*85)] flex items-end overflow-hidden">
        {/* A photo, not the video: the hero video is hundreds of MB and autoplayed on phones.
            The video stays the fallback for a landing without a hero photo. */}
        {page.heroImageUrl ? (
          <img
            src={page.heroImageUrl}
            alt={page.title}
            // Lowercase attribute: React 18's types don't know fetchPriority yet.
            {...{ fetchpriority: "high" }}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : page.heroVideoUrl && !page.heroClipUrl ? (
          <video
            src={page.heroVideoUrl}
            autoPlay
            muted
            playsInline
            // Pornește de la 0:59 și se reia tot de acolo (nu de la început) —
            // atributul nativ "loop" ar sări direct la 0, așa că bucla se face manual.
            // Ultimele HERO_VIDEO_LOOP_END_MARGIN secunde (credits-ul) sunt tăiate —
            // bucla o ia de la capăt înainte să ajungă acolo.
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              if (Number.isFinite(video.duration) && video.duration > HERO_VIDEO_LOOP_START) {
                video.currentTime = HERO_VIDEO_LOOP_START;
              }
            }}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              if (!Number.isFinite(video.duration)) return;
              const loopEnd = video.duration - HERO_VIDEO_LOOP_END_MARGIN;
              if (loopEnd > HERO_VIDEO_LOOP_START && video.currentTime >= loopEnd) {
                video.currentTime = HERO_VIDEO_LOOP_START;
              }
            }}
            onEnded={(e) => {
              const video = e.currentTarget;
              video.currentTime = HERO_VIDEO_LOOP_START;
              void video.play();
            }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
        )}

        {page.heroClipUrl && <HeroVideo src={page.heroClipUrl} hdSrc={page.heroClipHdUrl} />}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        <div className="relative w-full max-w-6xl mx-auto px-6 pb-16 pt-32">
          <p className="text-amber-200 text-xs tracking-[0.3em] uppercase mb-4 font-medium">
            Foto & video pentru povești reale
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-tight text-white mb-4 max-w-2xl">
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="text-neutral-300 text-lg font-light max-w-xl mb-10 leading-relaxed">
              {page.subtitle}
            </p>
          )}
          {showPriceCta && (
            <a
              href="#configurator"
              onClick={() => sendLiveEvent("configurator_cta_clicked", { label: "Află prețul în 30 de secunde", meta: { source: "hero" } })}
              className="price-cta-in mb-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-7 py-4 text-sm font-bold uppercase tracking-[0.1em] text-neutral-950 shadow-lg shadow-black/40 transition-colors hover:bg-neutral-100 active:scale-[0.98] sm:w-auto"
            >
              Află prețul în 30 de secunde <ArrowIcon />
              <style>{"@keyframes priceCtaIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.price-cta-in{animation:priceCtaIn .45s ease-out both}@media (prefers-reduced-motion:reduce){.price-cta-in{animation:none}}"}</style>
            </a>
          )}
          {/* Pe mobil, bara fixă de jos are deja "Verifică data" + WhatsApp —
              butoanele astea două ar dubla acțiunea și aglomerau hero-ul. */}
          <div className="hidden sm:flex flex-col sm:flex-row gap-3">
            <a
              href={availabilityHref}
              className="inline-flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold px-7 py-4 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-green-900/40"
            >
              Verifică dacă data ta este disponibilă <ArrowIcon />
            </a>
            <PhoneNumberReveal
              phone={page.phoneNumber}
              buttonLabel="AFIȘEAZĂ NUMĂRUL"
              context={`campanie ${page.slug} · hero`}
              onRevealed={() => trackClick("click_phone", "hero")}
              className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/20 backdrop-blur text-white font-medium px-7 py-4 rounded-xl text-sm border border-white/20 transition-all active:scale-[0.98]"
              icon={<PhoneIcon />}
            />
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/65">
            <span>✓ Peste 50 de evenimente fotografiate și filmate</span>
            <span>✓ Echipă foto-video pentru nunți în {visitorCity ? `${visitorCity} și Transilvania` : "Transilvania"}</span>
            <span>✓ Îți personalizăm oferta</span>
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO — rămâne sus, imediat după hero ── */}
      {galleryItems.length > 0 && (
        <LazySection height={stableVh(100)} onShow={() => preloadGroup(1)}>
        <PortfolioParallaxGallery
          fallback={<SectionSkeleton height={stableVh(100)} />}
          images={galleryImageUrls}
          batchSize={12}
          warnings={galleryWarnings}
          altBase="fotografie și videografie Anca Visuals"
        />
        </LazySection>
      )}

      {/* ── FILM — same full-bleed look as the hero: a photo, then the clip once it has
          downloaded (only while this section is on screen) ── */}
      {(page.heroClipUrl || galleryImageUrls.length > 1) && (
        <section className="relative flex min-h-[calc(var(--stable-vh,1vh)*90)] items-end overflow-hidden bg-neutral-950 text-white">
          {(galleryImageUrls[1] || page.heroImageUrl) && (
            <img
              src={galleryImageUrls[1] || page.heroImageUrl}
              alt="Cuplu fotografiat de Anca Visuals în ziua nunții"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {page.heroClipUrl && <HeroVideo src={page.heroClipUrl} hdSrc={page.heroClipHdUrl} />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-32 sm:pb-20">
            <h2 className="max-w-2xl text-3xl font-light leading-tight sm:text-5xl">
              Momente reale. Așa cum le trăiți.
            </h2>
          </div>
        </section>
      )}

      {/* ── MEDIA PROMO FOOTER (a doua galerie rămâne sus pe celelalte campanii) ── */}
      {!promoAtPageEnd && <LazySection height={stableVh(100)}><AncaVisualsPromo fallback={<SectionSkeleton height={stableVh(100)} />} /></LazySection>}

      {/* ── OFERTĂ FOTOCABINĂ — short: what, for whom, until when (no countdown) ── */}
      <section className="bg-white px-6 py-16 text-neutral-950 sm:py-20">
        <div className="mx-auto max-w-lg text-center">
          <p className="flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.35em] text-neutral-500">
            <span className="h-px w-10 bg-neutral-300/60" />
            Ofertă limitată
            <span className="h-px w-10 bg-neutral-300/60" />
          </p>
          <h2 className="mt-5 text-4xl font-normal uppercase leading-tight tracking-[0.05em] sm:text-5xl">🎁 Fotocabina e gratuită</h2>
          {promoExpired ? (
            <p className="mt-4 text-sm text-neutral-600">Oferta s-a încheiat.</p>
          ) : (
            <>
              <p className="mx-auto mt-4 max-w-sm text-sm font-medium leading-relaxed text-neutral-700 sm:text-base">Doar pentru următoarele 2 nunți rezervate.</p>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-950/15 bg-neutral-100 px-5 py-2.5 text-sm text-neutral-950">
                Până pe <strong className="font-semibold">30 octombrie 2026</strong>
              </p>
              <div>
                <a
                  href={availabilityHref}
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-800"
                >
                  Verifică disponibilitatea
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── VIDEO PLAYER ──────────────────────────────────────────── */}
      {(page.videoUrl || page.heroVideoUrl) && (
        <LazySection height={stableVh(60)} onShow={() => preloadGroup(1)}>
        <section id="film" className="scroll-mt-6 py-20 sm:py-24 border-b border-white/10">
          <div className="mb-8 px-6 text-center">
            <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Video</p>
            <h2 className="text-3xl font-light">Vezi-ne la lucru</h2>
          </div>
          {/* Phones: edge to edge (no padding, corners or border). Desktop: a framed, narrower player — full width was too wide. */}
          <div className="md:mx-auto md:max-w-5xl md:px-6">
          <div className="md:overflow-hidden md:rounded-2xl md:shadow-2xl md:shadow-black/60 md:ring-1 md:ring-white/10">
          {isEmbedVideoUrl(page.videoUrl ?? "") ? (
            <div className="aspect-video w-full bg-black">
              <iframe
                src={page.videoUrl}
                className="h-full w-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            </div>
          ) : (
            <CampaignVideoPlayer
              fallback={<div aria-hidden="true" className="aspect-video w-full animate-pulse bg-white/[0.06] motion-reduce:animate-none" />}
              src={(page.videoUrl || page.heroVideoUrl) as string}
              poster={page.videoThumbnailUrl || undefined}
            />
          )}
          </div>
          </div>
        </section>
        </LazySection>
      )}

      {/* ── CONFIGURATOR — preț pe loc, apoi verificarea datei ───────── */}
      {CONFIGURATOR_SLUGS.has(page.slug) && (
        <PriceConfigurator
          waLink={waLink}
          onWhatsAppClick={(position) => trackClick("click_whatsapp", position)}
          photoboothFree={!promoExpired}
          dateParts={dateParts}
          onDatePart={setDatePart}
          eventDate={form.eventDate}
          bookedDates={bookedDates}
          onEventChange={(eventType) => setForm((c) => (c.eventType === eventType ? c : { ...c, eventType }))}
          onDateChecked={(eventDate, available, eventType) => {
            trackFormStart();
            trackFormAction();
            reportAvailabilityCheck(formatDateRo(eventDate), eventDate, available, eventType);
            measureOaiq("availability_checked", { page_path: `/oferta/${page.slug}` });
          }}
          onSubmitLead={(contact) => submitLead(contact, "configurator")}
          onLocationChange={(location) => setForm((c) => (c.location === location ? c : { ...c, location }))}
          onBook={() => {
            setAvailStatus(bookedDates.includes(form.eventDate) ? "unavailable" : "available");
            // Phone form: the availability section, or the configurator's own step 5 while it is off.
            document.getElementById(SHOW_AVAILABILITY_SECTION ? "verifica-data" : "configurator-contact")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {/* ── AVAILABILITY CHECK — off for now, see SHOW_AVAILABILITY_SECTION ── */}
      {(SHOW_AVAILABILITY_SECTION || !CONFIGURATOR_SLUGS.has(page.slug)) && (
      <section id="verifica-data" className="scroll-mt-6 border-b border-white/10 bg-neutral-900 px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] lg:items-center">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-amber-200">Verifică disponibilitatea</p>
            <h2 className="max-w-xl text-3xl font-light leading-tight sm:text-4xl">Spune-ne tipul evenimentului și data.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400">Îți spunem pe loc dacă suntem liberi. Fără să lași date de contact.</p>
          </div>

          {/* min-height fix — cardul avea înălțimi diferite în funcție de starea
              afișată (formular gol vs. mesaj disponibilitate vs. formular telefon
              vs. confirmare), ceea ce făcea layout-ul să sară vizibil la fiecare
              pas. Rezervăm dinainte spațiul pentru cea mai "plină" stare. */}
          <div className="min-h-[560px] rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 sm:p-6">
            <form onSubmit={checkAvailability} data-live-track="off" className="space-y-3">
              <select
                value={form.eventType}
                onChange={(e) => { setForm((c) => ({ ...c, eventType: e.target.value })); setAvailStatus("idle"); }}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3.5 text-sm text-white outline-none focus:border-amber-500"
              >
                <option>Nuntă</option>
                <option>Botez</option>
                <option>Majorat</option>
                <option>Cununie civilă</option>
                <option>Alt eveniment</option>
              </select>
              <div className="grid grid-cols-[80px_1fr_100px] gap-2">
                <select
                  aria-label="Ziua"
                  value={dateParts.day ?? ""}
                  onChange={(e) => setDatePart({ day: e.target.value === "" ? null : Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-3.5 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="">Zi</option>
                  {(() => {
                    const known = dateParts.year !== null && dateParts.month !== null;
                    const maxDay = known ? daysInMonth(dateParts.year!, dateParts.month!) : 31;
                    const minDay = known && dateParts.year === todayYear && dateParts.month === todayMonth ? todayDay : 1;
                    return Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ));
                  })()}
                </select>
                <select
                  aria-label="Luna"
                  value={dateParts.month ?? ""}
                  onChange={(e) => setDatePart({ month: e.target.value === "" ? null : Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-3.5 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="">Luna</option>
                  {MONTHS_RO_CAP.map((label, index) => (
                    (dateParts.year === null || dateParts.year > todayYear || index >= todayMonth) && (
                      <option key={label} value={index}>{label}</option>
                    )
                  ))}
                </select>
                <select
                  aria-label="Anul"
                  value={dateParts.year ?? ""}
                  onChange={(e) => setDatePart({ year: e.target.value === "" ? null : Number(e.target.value) })}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-3.5 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="">An</option>
                  {Array.from({ length: 4 }, (_, i) => todayYear + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={availStatus === "checking" || !form.eventDate}
                className="w-full rounded-xl bg-amber-600 py-4 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:bg-neutral-700"
              >
                {availStatus === "checking" ? "Se verifică…" : form.eventDate ? "Verifică disponibilitatea" : "Alege data evenimentului"}
              </button>
            </form>

            <div className="mt-4 border-t border-neutral-800 pt-4 text-center">
              <p className="mb-2 text-xs text-neutral-400">Preferi să vorbim direct?</p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <PhoneNumberReveal
                  phone={page.phoneNumber}
                  buttonLabel="Afișează numărul de telefon"
                  revealedPrefix="Sună — "
                  context={`campanie ${page.slug} · verificare disponibilitate`}
                  onRevealed={() => trackClick("click_phone", "availability")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
                  icon={<PhoneIcon />}
                />
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackClick("click_whatsapp", "availability")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-400"
                >
                  <WhatsAppIcon /> Scrie-ne pe WhatsApp
                </a>
              </div>
            </div>

            {(availStatus === "available" || availStatus === "unavailable") && formStatus !== "sent" && (() => {
              const free = availStatus === "available";
              const dateLabel = formatDateRo(form.eventDate);
              const event = form.eventType.toLowerCase();
              // Same terms as the "Ofertă limitată" section: first 2 weddings, until PROMO_DEADLINE.
              const photoboothGift = free && !promoExpired && form.eventType === "Nuntă";
              const waText = free
                ? `Bună! Am văzut că data de ${dateLabel} e liberă. Aș dori oferta pentru ${event}${photoboothGift ? ", cu fotocabina gratuită" : ""}.`
                : `Bună! Am văzut că ${dateLabel} e ocupată. Aveți o soluție pentru ${event}?`;
              const startingPrice = startingPriceFor(form.eventType, startingPrices);
              return (
                <div className={`mt-4 rounded-xl border p-4 ${free ? "border-green-700/40 bg-green-900/25" : "border-amber-700/40 bg-amber-900/20"}`}>
                  <p className={`text-sm font-medium ${free ? "text-green-300" : "text-amber-200"}`}>
                    {free ? `🎉 Data ta, ${dateLabel}, e liberă!` : `Data ${dateLabel} pare deja rezervată.`}
                  </p>
                  {free && (
                    <p className="mt-1 text-sm text-white">Pachetele foto-video încep de la <span className="font-semibold text-amber-300">{startingPrice}</span>.</p>
                  )}
                  {photoboothGift && (
                    <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      🎁 <span className="font-semibold">+ Fotocabina e gratuită</span> dacă rezervi până pe 30 octombrie — doar pentru următoarele 2 nunți.
                    </p>
                  )}
                  {!free && <p className="mt-1 text-xs text-neutral-400">Uneori se eliberează sau găsim o soluție — scrie-ne.</p>}

                  <a
                    href={waLink(waText)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackClick("click_whatsapp", free ? "avail_ok" : "avail_no")}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-green-400"
                  >
                    <WhatsAppIcon /> {free ? "Primește oferta pe WhatsApp" : "Întreabă pe WhatsApp"}
                  </a>
                  <p className="mt-1 text-center text-[11px] text-neutral-500">Mesajul cu data ta e deja scris — doar apeși Trimite.</p>

                  {/* Phone field shown right away — one tap less than the old "Lasă-ne numărul" toggle. */}
                  <form onSubmit={handleFormSubmit} onFocus={trackFormStart} data-live-track="off" className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
                    <p className="text-xs text-neutral-400">sau lasă numărul și te sunăm noi:</p>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      name="phone"
                      placeholder="Telefon sau WhatsApp"
                      value={form.phone}
                      onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-amber-500"
                    />
                    {formStatus === "error" && <p className="text-sm text-red-400">A apărut o eroare. Încearcă din nou sau scrie-ne pe WhatsApp.</p>}
                    <button
                      type="submit"
                      disabled={formStatus === "sending" || !form.phone}
                      className="w-full rounded-xl border border-amber-500/50 bg-amber-500/10 py-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      {formStatus === "sending" ? "Se trimite…" : "Sunați-mă"}
                    </button>
                  </form>
                </div>
              );
            })()}

            {formStatus === "sent" && (
              <div className="mt-4 rounded-xl border border-green-700/40 bg-green-900/30 p-6 text-center">
                <p className="mb-1 text-2xl">✓</p>
                <p className="text-sm font-medium text-green-300">Am primit numărul tău!</p>
                <p className="mt-1 text-xs text-neutral-400">Te contactăm în curând pentru {formatDateRo(form.eventDate)}.</p>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── PACKAGES ───────────────────────────────────────────────── */}
      {page.packages.length > 0 && (SHOW_PACKAGES_SECTION || !CONFIGURATOR_SLUGS.has(page.slug)) && (
        <CampaignPackages
          packages={page.packages}
          waLink={waLink}
          onWhatsAppClick={(position) => trackClick("click_whatsapp", position)}
        />
      )}

      {/* ── TESTIMONIALS ───────────────────────────────────────────── */}
      {page.testimonials.length > 0 && (
        <section className="py-24 px-6 max-w-6xl mx-auto">
          <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Recenzii</p>
          <h2 className="text-3xl font-light text-white mb-10">Ce spun clienții</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {page.testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <p className="text-neutral-300 text-sm leading-relaxed mb-5 italic">"{testimonial.text}"</p>
                <div>
                  <p className="text-white text-sm font-medium">{testimonial.name}</p>
                  <p className="text-neutral-500 text-xs capitalize mt-0.5">{testimonial.eventType}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FINAL CTA ──────────────────────────────────────────────── */}
      <section id="oferta" className="py-24 px-6 bg-neutral-900 border-t border-neutral-800 scroll-mt-6">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-amber-200 text-xs tracking-[0.25em] uppercase mb-3">Următorul pas</p>
          <h2 className="text-3xl sm:text-4xl font-light text-white mb-3">Hai să vedem dacă data ta e liberă.</h2>
          <p className="text-neutral-400 text-sm mb-8 leading-relaxed">Verifică disponibilitatea în 5 secunde sau scrie-ne direct.</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a href={availabilityHref}
              className="flex-1 inline-flex items-center justify-center gap-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all"
            >
              Verifică disponibilitatea <ArrowIcon />
            </a>
            <a href={whatsappLink} target="_blank" rel="noreferrer" onClick={() => trackClick("click_whatsapp", "final_cta")}
              className="flex-1 inline-flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all"
            >
              <WhatsAppIcon />
              {page.ctaText || "Scrie pe WhatsApp"}
            </a>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row justify-center gap-3">
            <PhoneNumberReveal
              phone={page.phoneNumber}
              buttonLabel="Sună acum"
              revealedPrefix="Sună acum — "
              context={`campanie ${page.slug} · CTA final`}
              onRevealed={() => trackClick("click_phone", "final_cta")}
              className="inline-flex items-center justify-center gap-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium px-6 py-3.5 rounded-xl text-sm border border-neutral-700 transition-all"
              icon={<PhoneIcon />}
            />
            <a
              href="https://instagram.com/ancavisuals"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-neutral-700 bg-neutral-800 px-6 py-3.5 text-sm font-medium text-white transition-all hover:bg-neutral-700"
            >
              <InstagramIcon /> Vezi-ne pe Instagram
            </a>
          </div>

          {/* ── CALLBACK REQUEST — pentru cei care nu au chef să scrie/sune ── */}
          <div className="mt-8 flex items-center gap-3 text-neutral-700">
            <span className="h-px flex-1 bg-neutral-800" />
            <span className="text-[11px] uppercase tracking-[0.2em]">sau</span>
            <span className="h-px flex-1 bg-neutral-800" />
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-amber-700/40 bg-amber-500/[0.06] p-5 text-left sm:p-6">
            <p className="text-sm font-semibold text-amber-200">📞 Mai simplu: te sunăm noi.</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Lasă-ne numărul și te sunăm noi.
            </p>
            {formStatus === "sent" ? (
              <p className="mt-3 text-sm font-medium text-green-300">✓ Am primit numărul tău — te sunăm noi în curând!</p>
            ) : (
              <form
                onSubmit={handleFormSubmit}
                onFocus={trackFormStart}
                data-live-track="off"
                className="mt-3 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  name="phone"
                  placeholder="Numărul tău"
                  value={form.phone}
                  onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                  className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={formStatus === "sending" || !form.phone}
                  className="whitespace-nowrap rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:bg-neutral-700"
                >
                  {formStatus === "sending" ? "Se trimite…" : "Sună-mă tu"}
                </button>
              </form>
            )}
            {formStatus === "error" && (
              <p className="mt-2 text-xs text-red-400">A apărut o eroare. Încearcă din nou sau scrie-ne pe WhatsApp.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── GHIDUL MIRILOR — PDF gratuit ───────────────────────────── */}
      {WEDDING_GUIDE_SLUGS.has(page.slug) && (
        <LazySection height={stableVh(70)}>
        <section className="bg-[#f6f2ea] px-6 py-16 text-[#2f2a24] sm:py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
            <GuideBook />

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a6d3b]">PDF gratuit · 15 pagini</p>
              <h2 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Ghidul Mirilor</h2>
              <p className="mt-4 text-base leading-relaxed text-[#5c5348]">
                Tot ce ne-ar fi plăcut să știe toți mirii de la început, adunat din zecile de nunți la care am fost alături de cupluri.
              </p>
              <ul className="mt-6 grid gap-2.5 text-sm sm:grid-cols-2">
                {WEDDING_GUIDE_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2f2a24] text-[11px] text-[#f6f2ea]">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={WEDDING_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackGuideDownload}
                className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#2f2a24] px-6 py-4 text-sm font-semibold text-[#f6f2ea] transition-colors hover:bg-black sm:w-auto"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Descarcă ghidul gratuit
              </a>
              <p className="mt-3 text-xs text-[#5c5348]/80">Fără email, fără înregistrare — se deschide direct.</p>
            </div>
          </div>
        </section>
        </LazySection>
      )}

      {promoAtPageEnd && <LazySection height={stableVh(100)}><AncaVisualsPromo desktopColumns={4} fallback={<SectionSkeleton height={stableVh(100)} />} /></LazySection>}

      {isLiveChatConfigured() && <ChatWithUs />}

      <div className="py-6 text-center">
        <p className="text-neutral-700 text-xs">© Ancavisuals · ancavisuals.ro</p>
        <button
          type="button"
          onClick={openCookieSettings}
          className="mt-2 text-neutral-600 hover:text-neutral-400 text-[11px] underline underline-offset-2 transition-colors"
        >
          Setări cookie
        </button>
      </div>
    </div>
  );
}
