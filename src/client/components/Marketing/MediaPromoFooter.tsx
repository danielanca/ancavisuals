import { useEffect, useState, useCallback } from "react";

const PROMO_PHONE = "0745469907";
const PROMO_PHONE_DISPLAY = "0745 469 907";

function trackContactClick(type: "phone" | "whatsapp" | "instagram") {
  fetch("/api/analytics/contact-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, page: window.location.pathname }),
  }).catch(() => {});
}

export default function MediaPromoFooter() {
  const [showcasePhotos, setShowcasePhotos] = useState<string[]>([]);

  const handlePhoneClick = useCallback(() => trackContactClick("phone"), []);
  const handleWhatsAppClick = useCallback(() => trackContactClick("whatsapp"), []);
  const handleInstagramClick = useCallback(() => trackContactClick("instagram"), []);

  useEffect(() => {
    fetch("/api/showcase-zones/media_footer")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { photos?: string[] } | null) => {
        if (data?.photos?.length) setShowcasePhotos(data.photos);
      })
      .catch(() => {});
  }, []);

  return (
    <section style={{ background: "#0a0a0a", marginTop: "64px" }}>
      <div style={{
        height: "2px",
        background: "linear-gradient(90deg, transparent 0%, #c9a96e 20%, #e8c97a 50%, #c9a96e 80%, transparent 100%)",
      }} />

      {showcasePhotos.length > 0 && (
        <div style={{ display: "flex", height: "180px", overflow: "hidden", gap: "2px" }}>
          {showcasePhotos.slice(0, 8).map((url, index) => (
            <div key={`${url}-${index}`} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <img
                src={url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75, display: "block" }}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center", padding: "56px 24px 64px" }}>
        <div style={{ width: "36px", height: "1px", background: "#c9a96e", margin: "0 auto 28px", opacity: 0.6 }} />

        <p style={{ color: "#c9a96e", fontSize: "10px", letterSpacing: "5px", textTransform: "uppercase", margin: "0 0 22px", fontWeight: 500 }}>
          Anca Visuals
        </p>

        <h2 style={{ color: "#f0ebe0", fontSize: "clamp(20px, 4vw, 30px)", fontWeight: 300, margin: "0 0 16px", lineHeight: 1.35, letterSpacing: "0.3px" }}>
          Fotografie de film pentru<br />momentele tale autentice
        </h2>

        <p style={{ color: "#555", fontSize: "13px", margin: "0 0 10px", lineHeight: 1.7 }}>
          Creăm amintiri fără vârstă prin arta fotografiei analogice.
        </p>

        <p style={{ color: "#c9a96e", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", margin: "0 0 40px", opacity: 0.7 }}>
          Nuntă · Botez · Majorat · Fotocabină · Videobooth 360°
        </p>

        <div style={{ width: "36px", height: "1px", background: "#c9a96e", margin: "0 auto 40px", opacity: 0.25 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px", margin: "0 auto" }}>
          <a
            href={`tel:${PROMO_PHONE}`}
            onClick={handlePhoneClick}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "15px 24px",
              background: "#c9a96e",
              color: "#0a0a0a",
              borderRadius: "3px",
              textDecoration: "none",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
            }}
          >
            Sună — {PROMO_PHONE_DISPLAY}
          </a>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <a
              href={`https://wa.me/40${PROMO_PHONE.slice(1)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "13px 16px",
                background: "transparent",
                border: "1px solid #222",
                color: "#666",
                borderRadius: "3px",
                textDecoration: "none",
                fontSize: "11px",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              WhatsApp
            </a>
            <a
              href="https://instagram.com/ancavisuals"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstagramClick}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "13px 16px",
                background: "transparent",
                border: "1px solid #222",
                color: "#666",
                borderRadius: "3px",
                textDecoration: "none",
                fontSize: "11px",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
