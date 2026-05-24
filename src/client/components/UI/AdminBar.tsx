import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import useAuth from "../../features/admin/auth/useAuth";
import { useErrorMonitor } from "../../features/admin/providers/ErrorMonitorContext";

type Subscriber = { email: string; subscribedAt?: string };

export default function AdminBar() {
  const { auth, logOut } = useAuth();
  const location = useLocation();
  useErrorMonitor();
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscribersLoaded, setSubscribersLoaded] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const mediaSlugMatch = location.pathname.match(/^\/media\/([^/]+)$/);
  const albumSlug = mediaSlugMatch ? mediaSlugMatch[1] : null;

  const fetchSubscribers = (slug: string, token: string) => {
    fetch(`/api/album-subscriptions/list/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => response.json() as Promise<{ subscribers?: Subscriber[] }>)
      .then(data => {
        setSubscribers(data.subscribers ?? []);
        setSubscribersLoaded(true);
      })
      .catch(() => { setSubscribersLoaded(true); });
  };

  useEffect(() => {
    if (!albumSlug || !auth.accessToken) return;
    setSubscribersLoaded(false);
    fetchSubscribers(albumSlug, auth.accessToken);
  }, [albumSlug, auth.accessToken]);

  const handleBellToggle = () => {
    if (!bellOpen && albumSlug && auth.accessToken) {
      fetchSubscribers(albumSlug, auth.accessToken);
    }
    setBellOpen(open => !open);
  };

  if (!auth.authorise) return null;

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
        <a href="/admin" style={{ color: "#444", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px", textDecoration: "none" }}>
          Anca Visuals Admin
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {albumSlug && (
            <div ref={bellRef} style={{ position: "relative" }}>
              {bellOpen && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: -1 }}
                  onClick={() => setBellOpen(false)}
                />
              )}
              <button
                onClick={handleBellToggle}
                style={{
                  ...btnStyle,
                  color: subscribers.length > 0 ? "#facc15" : "#555",
                  border: `1px solid ${subscribers.length > 0 ? "#713f12" : "#2a2a2a"}`,
                }}
              >
                🔔
                {subscribersLoaded && (
                  <span style={{ background: subscribers.length > 0 ? "#713f12" : "#1a1a1a", color: subscribers.length > 0 ? "#fef08a" : "#555", fontSize: "10px", fontWeight: 700, padding: "0px 5px", borderRadius: "999px", lineHeight: "16px" }}>
                    {subscribers.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  minWidth: "200px",
                  maxWidth: "300px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                  zIndex: 100,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", color: "#888" }}>
                      {subscribers.length > 0 ? `${subscribers.length} abonat${subscribers.length !== 1 ? "i" : ""}` : "Niciun abonat"}
                    </span>
                    <button
                      onClick={handleNotify}
                      disabled={notifyStatus === "loading" || subscribers.length === 0}
                      style={{
                        ...btnStyle,
                        padding: "3px 8px",
                        fontSize: "10px",
                        border: `1px solid ${notifyStatus === "success" ? "#166534" : notifyStatus === "error" ? "#7f1d1d" : "#2a2a2a"}`,
                        color: notifyStatus === "success" ? "#4ade80" : notifyStatus === "error" ? "#f87171" : "#555",
                      }}
                    >
                      {notifyStatus === "loading" ? "..." : notifyStatus === "success" ? "✓ Trimis" : notifyStatus === "error" ? "Eroare" : "Notifică"}
                    </button>
                  </div>
                  {subscribers.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {subscribers.map(subscriber => (
                        <a
                          key={subscriber.email}
                          href={`mailto:${subscriber.email}`}
                          style={{ display: "flex", alignItems: "center", gap: "6px", color: "#93c5fd", fontSize: "11px", textDecoration: "none", padding: "3px 0" }}
                        >
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                          {subscriber.email}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
