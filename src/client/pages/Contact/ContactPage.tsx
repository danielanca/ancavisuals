import React, { useEffect, useMemo, useState } from "react";
import { WWW_ORIGIN } from "../../utils/address";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Navbar/Footer";
import Breadcrumbs from "../../components/SEO/Breadcrumbs";
import SeoPageHead from "../../components/SEO/SeoPageHead";
import PriceConfigurator, { type DatePick } from "../CampaignLanding/PriceConfigurator";
import HeroVideo from "../CampaignLanding/HeroVideo";
import LazySection from "../CampaignLanding/LazySection";
import SectionSkeleton from "../CampaignLanding/SectionSkeleton";
import FramedVideoSection from "../CampaignLanding/FramedVideoSection";
import { CampaignVideoPlayer, PortfolioParallaxGallery } from "../CampaignLanding/lazyParts";
import { daysInMonth, formatDateRo, galleryOriginals, galleryRatios, galleryTileUrl, isEmbedVideoUrl, isHeavyPhoto, toIso, type CampaignPage } from "../CampaignLanding/CampaignLandingPage";
import { offerToCampaign, type Offer } from "../OfertaPage";
import { measureOaiq } from "../../utils/oaiq";
import { reportAvailabilityCheck, sendLiveEvent } from "../../utils/liveEvent";
import { fireAdsLeadConversion, fireAdsOlxConfiguratorConversion } from "../../utils/googleAds";
import { getLandingMeta } from "../../utils/sessionAttribution";
import { useReferral } from "../../utils/referral";
import { isPromoOpen, remainingSlotsNote, useFreePhotoboothOffer } from "../CampaignLanding/freePhotoboothOffer";
import { stableVh } from "../../utils/stableViewport";
import ChatWithUs from "../../features/chat/components/ChatWithUs";
import { isLiveChatConfigured } from "../../features/chat/components/LiveChat";

/*
 * /contact = the same price configurator as /oferta/olx, with that landing's autoplay clip and
 * portfolio photos. Leads go to the same endpoint (`/api/campaign/olx/contact`), marked as sent
 * from /contact, so prices (/admin/preturi), emails, Ads conversions and the live panel match.
 */
const OFFER_SLUG = "olx";
const PAGE_PATH = "/contact";
const WHATSAPP_NUMBER = "40745469907";
const waLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

/** The /oferta/olx data: the campaign, or the "olx" offer template it falls back to. */
async function loadOfferPage(): Promise<CampaignPage | null> {
  const campaignResponse = await fetch(`/api/campaign/public/${OFFER_SLUG}`);
  if (campaignResponse.ok) return campaignResponse.json() as Promise<CampaignPage>;
  const offerResponse = await fetch(`/api/oferte/${OFFER_SLUG}`);
  return offerResponse.ok ? offerToCampaign(await offerResponse.json() as Offer) : null;
}

const ContactPage = () => {
  const breadcrumbs = [
    { label: "Acasă", to: "/" },
    { label: "Contact" },
  ];
  const [page, setPage] = useState<CampaignPage | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const [dateParts, setDateParts] = useState<DatePick>({ day: null, month: null, year: null });
  const [form, setForm] = useState({ eventType: "Nuntă", eventDate: "", location: "" });
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const referral = useReferral();
  const photoboothOffer = useFreePhotoboothOffer();
  const photoboothFree = referral || isPromoOpen(photoboothOffer, Date.now());

  useEffect(() => {
    loadOfferPage().then(setPage).catch(() => setPage(null));
    fetch("/api/booked-dates")
      .then((r) => r.json())
      .then((d: { dates?: string[] }) => setBookedDates(d.dates ?? []))
      .catch(() => setBookedDates([]));
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Same photos as /oferta/olx for this device, without the heavy ones (> 1 MB).
  const galleryItems = useMemo(() => {
    if (!page) return [];
    const items = isMobile
      ? (page.galleryMobile?.length ? page.galleryMobile : page.gallery)
      : (page.galleryDesktop?.length ? page.galleryDesktop : page.gallery);
    return items.filter((item) => !isHeavyPhoto(item.sizeBytes));
  }, [page, isMobile]);
  const galleryImageUrls = useMemo(() => galleryItems.map(galleryTileUrl), [galleryItems]);
  const galleryImageRatios = useMemo(() => galleryRatios(galleryItems), [galleryItems]);
  const galleryImageOriginals = useMemo(() => galleryOriginals(galleryItems), [galleryItems]);

  const setDatePart = (patch: Partial<DatePick>) => {
    const today = new Date();
    setDateParts((prev) => {
      const next = { ...prev, ...patch };
      // Never let the picker land on an already-passed date.
      if (next.year !== null && next.month !== null && next.year === today.getFullYear() && next.month < today.getMonth()) next.month = null;
      if (next.year !== null && next.month !== null && next.day !== null) {
        const maxDay = daysInMonth(next.year, next.month);
        const minDay = next.year === today.getFullYear() && next.month === today.getMonth() ? today.getDate() : 1;
        if (next.day > maxDay) next.day = maxDay;
        if (next.day < minDay) next.day = minDay;
      }
      const complete = next.day !== null && next.month !== null && next.year !== null;
      setForm((f) => ({ ...f, eventDate: complete ? toIso(next.day!, next.month!, next.year!) : "" }));
      return next;
    });
  };

  const submitLead = async (contact: { name: string; phone: string; message?: string }): Promise<boolean> => {
    try {
      const landing = getLandingMeta();
      const res = await fetch(`/api/campaign/${OFFER_SLUG}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...contact,
          message: `Trimis de pe ${PAGE_PATH}\n${contact.message ?? ""}`.trim(),
          gclid: landing?.gclid,
          wbraid: landing?.wbraid,
          gbraid: landing?.gbraid,
          referral,
        }),
      });
      if (res.ok) {
        measureOaiq("lead_created", { type: "customer_action", page_path: PAGE_PATH });
        fireAdsLeadConversion({ phone: contact.phone });
        // Panel live only — the lead email is sent by /api/campaign/:slug/contact.
        sendLiveEvent("form_submitted", {
          priority: "critical",
          label: "🎯 Un client și-a trimis configurația de pe /contact — vrea să-l suni",
          meta: {
            kind: "configurator",
            source: "contact",
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

  return (
    <div className="min-h-screen bg-black text-white">
      <SeoPageHead
        title="Contact și Configurator Ofertă | Foto Video Nuntă, Botez și Evenimente | Anca Visuals"
        description="Configurează online oferta pentru fotografie, videografie, pachete foto-video, fotocabină și Video Booth 360. Lucrăm în Turda, Cluj, Sibiu, Alba, Arad, Bistrița și împrejurimi."
        canonicalPath="/contact"
        breadcrumbs={breadcrumbs}
        schema={{
          "@type": "ContactPage",
          "@id": `${WWW_ORIGIN}/contact#contact`,
          name: "Contact și configurator ofertă Anca Visuals",
          description:
            "Pagină de contact și configurare ofertă pentru foto, video, foto-video, fotocabină și Video Booth 360.",
        }}
        keywords={[
          "oferta fotograf nunta",
          "oferta videograf botez",
          "configurator foto video",
          "contact anca visuals",
        ]}
      />
      <Navbar />

      {/* ── HERO — the /oferta/olx photo, then its short clip on autoplay ── */}
      <section className="relative flex min-h-[calc(var(--stable-vh,1vh)*70)] items-end overflow-hidden bg-neutral-950">
        {page?.heroImageUrl && (
          <img src={page.heroImageUrl} alt="Anca Visuals — foto și video" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {page?.heroClipUrl && <HeroVideo src={page.heroClipUrl} hdSrc={page.heroClipHdUrl} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-12 pt-32">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="mt-4 max-w-2xl text-4xl font-light leading-none text-white sm:text-5xl">Contact</h1>
          <p className="mt-3 max-w-xl text-lg font-light leading-snug text-neutral-300">
            Configurează pachetul tău în câteva click-uri — preț, disponibilitate și detalii, pe loc.
          </p>
        </div>
      </section>

      <PriceConfigurator
        waLink={waLink}
        onWhatsAppClick={(position) => measureOaiq("click_whatsapp", { cta_position: position, page_path: PAGE_PATH })}
        photoboothFree={photoboothFree}
        photoboothNote={referral
          ? "Ai venit prin recomandare: fotocabina și QR code-ul sunt gratuite"
          : remainingSlotsNote(photoboothOffer)}
        dateParts={dateParts}
        onDatePart={setDatePart}
        eventDate={form.eventDate}
        bookedDates={bookedDates}
        onEventChange={(eventType) => setForm((c) => (c.eventType === eventType ? c : { ...c, eventType }))}
        onDateChecked={(eventDate, available, eventType) => {
          reportAvailabilityCheck(formatDateRo(eventDate), eventDate, available, eventType);
          measureOaiq("availability_checked", { page_path: PAGE_PATH });
        }}
        onPriceConfigured={() => fireAdsOlxConfiguratorConversion()}
        onSubmitLead={submitLead}
        onLocationChange={(location) => setForm((c) => (c.location === location ? c : { ...c, location }))}
        onBook={() => document.getElementById("configurator-contact")?.scrollIntoView({ behavior: "smooth" })}
      />

      {/* ── FILM — the same "Vezi-ne la lucru" stream as /oferta/olx, played on tap ── */}
      {(page?.videoUrl || page?.heroVideoUrl) && (
        <LazySection height={stableVh(60)}>
          <div className="border-b border-white/10 px-4 py-20 sm:px-6 sm:py-24">
            <FramedVideoSection id="film" title="Vezi-ne la lucru" subtitle="o zi reală, filmată de noi" className="scroll-mt-6">
              {isEmbedVideoUrl(page.videoUrl ?? "") ? (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={page.videoUrl}
                    title="Vezi-ne la lucru"
                    className="h-full w-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <CampaignVideoPlayer
                  variant="mono"
                  fallback={<div aria-hidden="true" className="aspect-video w-full animate-pulse bg-white/[0.06] motion-reduce:animate-none" />}
                  src={(page.videoUrl || page.heroVideoUrl) as string}
                  poster={page.videoThumbnailUrl || undefined}
                  label="Vezi-ne la lucru"
                />
              )}
            </FramedVideoSection>
          </div>
        </LazySection>
      )}

      {/* ── PORTFOLIO — the same photos as /oferta/olx ── */}
      {galleryImageUrls.length > 0 && (
        <LazySection height={stableVh(100)}>
          <PortfolioParallaxGallery
            fallback={<SectionSkeleton height={stableVh(100)} />}
            images={galleryImageUrls}
            ratios={galleryImageRatios}
            originals={galleryImageOriginals}
            batchSize={12}
            altBase="fotografie și videografie Anca Visuals"
          />
        </LazySection>
      )}

      {/* Above the footer; App.tsx leaves /contact out of its own <ChatWithUs />. */}
      {isLiveChatConfigured() && <ChatWithUs />}

      <Footer />
    </div>
  );
};

export default ContactPage;
