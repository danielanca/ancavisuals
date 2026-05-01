import { useState } from "react";
import { useLocation } from "react-router-dom";
import useAuth from "../../features/admin/auth/useAuth";

export default function AdminBar() {
  const { auth, logOut } = useAuth();
  const location = useLocation();
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
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      background: "#0f0f0f",
      borderBottom: "1px solid #222",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "0 16px",
      height: "48px",
      fontSize: "13px",
      fontFamily: "sans-serif",
    }}>
      <span style={{ color: "#555" }}>
        Admin:&nbsp;<span style={{ color: "#aaa" }}>{auth.user?.email?.split("@")[0]}</span>
      </span>

      {albumSlug && (
        <button
          onClick={handleNotify}
          disabled={notifyStatus === "loading"}
          style={{
            background: notifyStatus === "success" ? "#052e16" : "none",
            border: `1px solid ${notifyStatus === "success" ? "#166534" : notifyStatus === "error" ? "#7f1d1d" : "#333"}`,
            borderRadius: "6px",
            color: notifyStatus === "success" ? "#4ade80" : notifyStatus === "error" ? "#f87171" : "#888",
            fontSize: "12px",
            padding: "5px 14px",
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

      {location.pathname !== "/admin" && (
        <a
          href="/admin"
          style={{
            background: "none",
            border: "1px solid #333",
            borderRadius: "6px",
            color: "#888",
            fontSize: "12px",
            padding: "5px 14px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Dashboard →
        </a>
      )}

      <button
        onClick={logOut}
        style={{
          background: "none",
          border: "1px solid #333",
          borderRadius: "6px",
          color: "#888",
          fontSize: "12px",
          padding: "5px 14px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Deloghează-te
      </button>
    </div>
  );
}
