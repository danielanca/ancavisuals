import { useState } from "react";
import { useLocation } from "react-router-dom";
import useAuth from "../../features/admin/auth/useAuth";
import { useErrorMonitor } from "../../features/admin/providers/ErrorMonitorContext";

export default function AdminBar() {
  const { auth, logOut } = useAuth();
  const location = useLocation();
  useErrorMonitor();
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

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

  const btnStyle: React.CSSProperties = {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    color: "#666",
    fontSize: "11px",
    padding: "5px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: 1.4,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
  };

  return (
    <div style={{
      position: "relative",
      zIndex: 20,
      background: "#0a0a0a",
      borderBottom: "1px solid #1a1a1a",
      fontFamily: "sans-serif",
    }}>
      <div style={{
        maxWidth: "56rem",
        width: "100%",
        margin: "0 auto",
        paddingBlock: "4px",
        paddingInline: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      }}>
        {/* Left: dashboard link */}
        <a href="/admin" style={{ color: "#444", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px", textDecoration: "none" }}>
          Anca Visuals Admin
        </a>

        {/* Right: actions — never wrap */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {albumSlug && (
            <button onClick={handleNotify} disabled={notifyStatus === "loading"} style={{
              ...btnStyle,
              border: `1px solid ${notifyStatus === "success" ? "#166534" : notifyStatus === "error" ? "#7f1d1d" : "#2a2a2a"}`,
              color: notifyStatus === "success" ? "#4ade80" : notifyStatus === "error" ? "#f87171" : "#666",
            }}>
              {notifyStatus === "loading" && "..."}
              {notifyStatus === "success" && `✓ ${subscriberCount}`}
              {notifyStatus === "error" && "!"}
              {notifyStatus === "idle" && "🔔"}
            </button>
          )}

          {!confirmLogout ? (
            <button onClick={() => setConfirmLogout(true)} style={btnStyle}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ color: "#555", fontSize: "11px", whiteSpace: "nowrap" }}>Sigur?</span>
              <button onClick={logOut} style={{ ...btnStyle, border: "1px solid #7f1d1d", color: "#f87171" }}>Da</button>
              <button onClick={() => setConfirmLogout(false)} style={btnStyle}>Nu</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
