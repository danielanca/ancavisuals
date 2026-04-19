import { useState, useEffect, useRef } from "react";

const CONSENT_KEY_PREFIX = "av:consent:";
const ADMIN_BYPASS_KEY = "av:consent:admin:bypass";
const ADMIN_TAP_TARGET = 10;

interface Props {
  slug: string;
  onAccepted: () => void;
}

export default function MediaConsentModal({ slug, onAccepted }: Props) {
  const consentKey = CONSENT_KEY_PREFIX + slug;

  const [phase, setPhase] = useState<"hidden" | "modal" | "banner">("hidden");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localStorage.getItem(ADMIN_BYPASS_KEY)) return; // admin bypass
    if (localStorage.getItem(consentKey)) {
      setPhase("banner");
    } else {
      setPhase("modal");
    }
  }, [consentKey]);

  const handleEmojiTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);

    if (tapCountRef.current >= ADMIN_TAP_TARGET) {
      localStorage.setItem(ADMIN_BYPASS_KEY, "1");
      setPhase("hidden");
      onAccepted();
    }
  };

  const handleAccept = async () => {
    if (!checked) return;
    setLoading(true);
    try {
      await fetch(`/api/album/${slug}/consent`, { method: "POST" });
    } catch {
      // nu blocăm clientul
    }
    localStorage.setItem(consentKey, "1");
    setPhase("banner");
    onAccepted();
    setLoading(false);
  };

  if (phase === "hidden") return null;

  // ── BANNER (vizite ulterioare) ────────────────────────────────────────────
  if (phase === "banner") {
    return (
      <div style={{
        margin: "16px 0",
        borderRadius: "12px",
        background: "rgba(234,179,8,0.08)",
        border: "1px solid rgba(234,179,8,0.25)",
        overflow: "hidden",
        transition: "all 0.2s",
      }}>
        {/* Header cu săgeată */}
        <div
          onClick={() => setCollapsed((p) => !p)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              onClick={(e) => { e.stopPropagation(); handleEmojiTap(); }}
              style={{ fontSize: "15px", userSelect: "none" }}
            >
              ⚠️
            </span>
            <span style={{ color: "#d4a800", fontSize: "13px", fontWeight: 600 }}>
              Descarcă materialele în 30 de zile
            </span>
          </div>
          <span style={{
            color: "#d4a800", fontSize: "12px",
            transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s", display: "inline-block",
          }}>
            ▲
          </span>
        </div>

        {/* Conținut collapsibil */}
        {!collapsed && (
          <div style={{ padding: "0 14px 12px", borderTop: "1px solid rgba(234,179,8,0.15)" }}>
            <p style={{ margin: "10px 0 0", color: "#b38600", fontSize: "13px", lineHeight: "1.5" }}>
              Pozele și videoul tău vor fi <strong>șterse automat după 30 de zile</strong> de la livrare. Salvează-le pe calculatorul sau laptopul tău cât mai curând. AncaVisuals nu poate fi responsabilă pentru materialele nedescărcate în acest interval.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── MODAL (prima vizită) ──────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "#111", border: "1px solid #2a2a2a",
        borderRadius: "20px", padding: "32px",
        maxWidth: "440px", width: "100%",
      }}>
        <div
          style={{ fontSize: "36px", textAlign: "center", marginBottom: "16px", cursor: "default", userSelect: "none" }}
          onClick={handleEmojiTap}
        >
          📦
        </div>

        <h2 style={{
          color: "#fff", fontSize: "18px", fontWeight: 600,
          textAlign: "center", margin: "0 0 12px",
        }}>
          Materialele tale sunt gata
        </h2>

        <p style={{ color: "#9ca3af", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px" }}>
          Pozele și videoul tău sunt disponibile pentru descărcare. Te rugăm să le salvezi pe calculatorul sau laptopul tău cât mai curând posibil.
        </p>

        <div style={{
          background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: "12px", padding: "14px 16px", marginBottom: "24px",
        }}>
          <p style={{ color: "#d4a800", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
            ⚠️ <strong>Atenție:</strong> materialele vor fi <strong>șterse automat după 30 de zile</strong> de la livrare. AncaVisuals nu poate fi responsabilă pentru materialele nedescărcate în acest interval.
          </p>
        </div>

        <label style={{
          display: "flex", alignItems: "flex-start", gap: "10px",
          cursor: "pointer", marginBottom: "24px",
        }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: "2px", width: "16px", height: "16px", flexShrink: 0, accentColor: "#7c3aed" }}
          />
          <span style={{ color: "#d1d5db", fontSize: "13px", lineHeight: "1.5" }}>
            Am înțeles că materialele vor fi șterse după 30 de zile și îmi asum responsabilitatea descărcării lor.
          </span>
        </label>

        <button
          onClick={handleAccept}
          disabled={!checked || loading}
          style={{
            width: "100%", padding: "14px",
            borderRadius: "12px", border: "none",
            background: checked ? "#7c3aed" : "#2a2a2a",
            color: checked ? "#fff" : "#6b7280",
            fontSize: "15px", fontWeight: 600,
            cursor: checked ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          {loading ? "Se înregistrează..." : "Am înțeles, continuă →"}
        </button>
      </div>
    </div>
  );
}
