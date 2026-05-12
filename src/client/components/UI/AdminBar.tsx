import { useState } from "react";
import { useLocation } from "react-router-dom";
import useAuth from "../../features/admin/auth/useAuth";
import { useErrorMonitor } from "../../features/admin/providers/ErrorMonitorContext";

export default function AdminBar() {
  const { auth, logOut } = useAuth();
  const location = useLocation();
  const { debugging, setDebugging } = useErrorMonitor();
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  if (!auth.authorise) return null;

  const mediaSlugMatch = location.pathname.match(/^\/media\/([^/]+)$/);
  const albumSlug = mediaSlugMatch ? mediaSlugMatch[1] : null;

  const handleNotify = async () => {
    if (!albumSlug || !auth.accessToken) return;
    setNotifyStatus("loading");
    try {
      const response = await fetch(`/api/album-subscriptions/notify/${albumSlug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await response.json() as { ok?: boolean; sent?: number };
      if (data.ok) {
        setNotifyStatus("success");
        setSubscriberCount(data.sent ?? 0);
        setTimeout(() => setNotifyStatus("idle"), 4000);
      } else {
        setNotifyStatus("error");
        setTimeout(() => setNotifyStatus("idle"), 3000);
      }
    } catch {
      setNotifyStatus("error");
      setTimeout(() => setNotifyStatus("idle"), 3000);
    }
  };

  return (
    <div style={{
      position: "relative",
      zIndex: 20,
      background: "#0f0f0f",
      borderBottom: "1px solid #222",
      fontFamily: "sans-serif",
    }}>
      <div style={{
        maxWidth: "56rem",
        width: "100%",
        margin: "0 auto",
        paddingBlock: "12px",
        paddingInline: "16px",
        minHeight: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
          <span style={{ color: "#555", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Admin
          </span>
          <span style={{ color: "#d4d4d4", fontSize: "15px", fontWeight: 600, lineHeight: 1.2 }}>
            {auth.user?.email?.split("@")[0]}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {albumSlug && (
            <button
              onClick={handleNotify}
              disabled={notifyStatus === "loading"}
              style={{
                background: notifyStatus === "success" ? "#052e16" : "none",
                border: `1px solid ${notifyStatus === "success" ? "#166534" : notifyStatus === "error" ? "#7f1d1d" : "#333"}`,
                borderRadius: "8px",
                color: notifyStatus === "success" ? "#4ade80" : notifyStatus === "error" ? "#f87171" : "#888",
                fontSize: "12px",
                padding: "8px 14px",
                cursor: notifyStatus === "loading" ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {notifyStatus === "loading" && "Se trimite..."}
              {notifyStatus === "success" && `✓ Trimis către ${subscriberCount} abonat${subscriberCount === 1 ? "" : "i"}`}
              {notifyStatus === "error" && "Eroare trimitere"}
              {notifyStatus === "idle" && "🔔 Notifică abonații"}
            </button>
          )}

          <button
            onClick={() => setDebugging(!debugging)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: debugging ? "#0f1f0f" : "none",
              border: `1px solid ${debugging ? "#166534" : "#333"}`,
              borderRadius: "8px",
              color: debugging ? "#4ade80" : "#555",
              fontSize: "12px",
              padding: "8px 14px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: debugging ? "#4ade80" : "#333",
              display: "inline-block",
              flexShrink: 0,
            }} />
            Debugging
          </button>

          {location.pathname !== "/admin" && (
            <a
              href="/admin"
              style={{
                background: "none",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#888",
                fontSize: "12px",
                padding: "8px 14px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Dashboard →
            </a>
          )}

          <a
            onClick={logOut}
            style={{
              background: "none",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#888",
              fontSize: "12px",
              padding: "8px 14px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Deloghează-te
          </a>
        </div>
      </div>
    </div>
  );
}
