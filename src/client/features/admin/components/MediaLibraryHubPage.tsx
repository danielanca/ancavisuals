import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import { ZONE_CONFIGS, ZONE_TAB_ORDER } from "./ShowcaseZoneEditorPage";

type CardData = {
  key: string;
  title: string;
  description: string;
  count: number;
  thumb?: string;
  href: string;
};

type OfferShowcaseService = {
  id: string;
  label: string;
  description: string;
  assets: Array<{ url: string; displayUrl?: string }>;
  assetsMobile: Array<{ url: string; displayUrl?: string }>;
};

type CampaignSummary = {
  slug: string;
  title: string;
  active: boolean;
  heroImageUrl?: string;
  gallery?: Array<{ url: string }>;
  galleryDesktop?: Array<{ url: string }>;
};

function CardGrid({ title, hint, cards, loading }: { title: string; hint: string; cards: CardData[]; loading: boolean }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
        {title}
      </h2>
      <p style={{ fontSize: 12, color: "#555", margin: "0 0 14px" }}>{hint}</p>
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 140, borderRadius: 14, background: "#141414" }} />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <p style={{ fontSize: 13, color: "#444" }}>Nimic disponibil momentan.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {cards.map((card) => (
            <Link
              key={card.key}
              to={card.href}
              style={{
                display: "block", borderRadius: 14, border: "1px solid #1a1a1a", background: "#111",
                overflow: "hidden", textDecoration: "none", transition: "border-color 0.15s",
              }}
            >
              <div style={{ height: 110, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {card.thumb ? (
                  <img src={card.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                ) : (
                  <span style={{ fontSize: 11, color: "#444" }}>Fără poze încă</span>
                )}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{card.title}</p>
                <p style={{ fontSize: 11, color: "#666", margin: "3px 0 10px", minHeight: 28 }}>{card.description}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#555" }}>{card.count} {card.count === 1 ? "element" : "elemente"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa" }}>Organizează pozele →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MediaLibraryHubPage() {
  const { auth } = useAuth();
  const [zoneCards, setZoneCards] = useState<CardData[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [offerCards, setOfferCards] = useState<CardData[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [campaignCards, setCampaignCards] = useState<CardData[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ZONE_TAB_ORDER.map((id) =>
        fetch(`/api/showcase-zones/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { photos?: string[]; desktop?: string[] } | null) => ({ id, data }))
          .catch(() => ({ id, data: null }))
      )
    ).then((results) => {
      if (cancelled) return;
      setZoneCards(
        results.map(({ id, data }) => {
          const config = ZONE_CONFIGS[id];
          const urls = data?.desktop?.length ? data.desktop : data?.photos ?? [];
          return {
            key: id,
            title: config?.label ?? id,
            description: config?.description ?? "",
            count: urls.length,
            thumb: urls[0],
            href: `/admin/showcase/${id}`,
          };
        })
      );
      setZonesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (auth.loading || !auth.accessToken) return;
    let cancelled = false;
    fetch("/api/oferte/admin/template-showcase", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { services?: OfferShowcaseService[] } | null) => {
        if (cancelled || !data?.services) return;
        setOfferCards(
          data.services.map((service) => ({
            key: service.id,
            title: service.label,
            description: service.description,
            count: service.assets.length,
            thumb: service.assets[0]?.displayUrl ?? service.assets[0]?.url,
            href: `/admin/template-oferte/${service.id}`,
          }))
        );
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOffersLoading(false); });
    return () => { cancelled = true; };
  }, [auth.loading, auth.accessToken]);

  useEffect(() => {
    if (auth.loading || !auth.accessToken) return;
    let cancelled = false;
    fetch("/api/campaign", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { pages?: CampaignSummary[] } | null) => {
        if (cancelled || !data?.pages) return;
        setCampaignCards(
          data.pages.map((page) => {
            const gallery = page.galleryDesktop?.length ? page.galleryDesktop : page.gallery ?? [];
            return {
              key: page.slug,
              title: `${page.title || page.slug}${page.active ? "" : " (inactivă)"}`,
              description: `/oferta/${page.slug}`,
              count: gallery.length,
              thumb: page.heroImageUrl || gallery[0]?.url,
              href: `/admin/campanii/${page.slug}`,
            };
          })
        );
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCampaignsLoading(false); });
    return () => { cancelled = true; };
  }, [auth.loading, auth.accessToken]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "20px 24px 80px" }}>
      <Breadcrumb />
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Bibliotecă Media</h1>
        <p style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
          Toate locurile din site unde apar poze/video, centralizate aici. Apasă „Organizează pozele" pe orice card ca să adaugi, ștergi sau reordonezi prin tragere — separat pentru desktop și mobil.
        </p>
      </div>

      <CardGrid
        title="Zone site"
        hint="Homepage, portofoliu, fâșia promo."
        cards={zoneCards}
        loading={zonesLoading}
      />
      <CardGrid
        title="Oferte individuale"
        hint="Galeria per serviciu de pe paginile /oferta/*."
        cards={offerCards}
        loading={offersLoading}
      />
      <CardGrid
        title="Campanii"
        hint="Galeria de pe paginile de campanie (ex. /oferta/olx)."
        cards={campaignCards}
        loading={campaignsLoading}
      />
    </div>
  );
}
