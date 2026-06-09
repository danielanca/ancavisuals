import React, { useEffect, useState, useCallback } from "react";
import useAuth from "../auth/useAuth";

type ActivityType = "visitor" | "subscribe" | "lead" | "offer_viewed" | "seo_visit";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata: Record<string, string>;
  read: boolean;
  emailSent: boolean;
  createdAt?: { seconds: number };
}

interface NotificationSettings {
  email: {
    newVisitor: boolean;
    returningVisitor: boolean;
    subscribe: boolean;
    lead: boolean;
    offerViewed: boolean;
    seoOrganic: boolean;
  };
}

const TYPE_ICON: Record<ActivityType, string> = {
  visitor: "👤",
  subscribe: "🔔",
  lead: "📝",
  offer_viewed: "👁",
  seo_visit: "🔍",
};

const TYPE_COLOR: Record<ActivityType, string> = {
  visitor: "#3b82f6",
  subscribe: "#f59e0b",
  lead: "#10b981",
  offer_viewed: "#8b5cf6",
  seo_visit: "#059669",
};

const TYPE_LABEL: Record<ActivityType, string> = {
  visitor: "Vizitator",
  subscribe: "Abonat",
  lead: "Lead",
  offer_viewed: "Ofertă",
  seo_visit: "SEO",
};

const SETTING_LABELS: (keyof NotificationSettings["email"])[] = [
  "newVisitor", "returningVisitor", "subscribe", "lead", "offerViewed", "seoOrganic",
];

const SETTING_DISPLAY: Record<keyof NotificationSettings["email"], string> = {
  newVisitor: "Vizitator NOU",
  returningVisitor: "Vizitator cunoscut",
  subscribe: "Abonat album",
  lead: "Lead Rapid / Booking",
  offerViewed: "Ofertă vizualizată",
  seoOrganic: "Vizitator organic SEO",
};

function timeAgo(seconds?: number): string {
  if (!seconds) return "";
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "acum";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}z`;
}

export default function ActivityInbox() {
  const { auth } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filter, setFilter] = useState<ActivityType | "all">("all");

  const unreadCount = activities.filter((a) => !a.read).length;

  const fetchActivities = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const res = await fetch("/api/admin/activity", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { activities: Activity[] };
      setActivities(data.activities ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [auth.accessToken]);

  const fetchSettings = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const res = await fetch("/api/admin/notification-settings", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (res.ok) setSettings(await res.json() as NotificationSettings);
    } catch { /* silent */ }
  }, [auth.accessToken]);

  useEffect(() => {
    fetchActivities();
    fetchSettings();
  }, [fetchActivities, fetchSettings]);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(fetchActivities, 30000);
    return () => clearInterval(id);
  }, [fetchActivities]);

  const markAllRead = async () => {
    if (!auth.accessToken) return;
    await fetch("/api/admin/activity/read-all", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    }).catch(() => {});
    setActivities((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  const markRead = async (id: string) => {
    if (!auth.accessToken) return;
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
    await fetch(`/api/admin/activity/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    }).catch(() => {});
  };

  const saveSettings = async () => {
    if (!auth.accessToken || !settings) return;
    setSavingSettings(true);
    await fetch("/api/admin/notification-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify(settings),
    }).catch(() => {});
    setSavingSettings(false);
    setShowSettings(false);
  };

  const filtered = filter === "all" ? activities : activities.filter((a) => a.type === filter);

  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #1a1a1a", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Activitate site</span>
          {unreadCount > 0 && (
            <span style={{ background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "1px 7px" }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ fontSize: 11, color: "#555", background: "none", border: "1px solid #222", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
              Marchează tot citit
            </button>
          )}
          <button
            onClick={() => { setShowSettings((v) => !v); }}
            style={{ fontSize: 11, color: showSettings ? "#a78bfa" : "#555", background: "none", border: `1px solid ${showSettings ? "#5b21b6" : "#222"}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
          >
            ⚙ Email
          </button>
        </div>
      </div>

      {/* Email settings panel */}
      {showSettings && settings && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
          <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Trimite email pentru</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SETTING_LABELS.map((key) => (
              <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: 13, color: "#aaa" }}>{SETTING_DISPLAY[key]}</span>
                <div
                  onClick={() => setSettings((prev) => prev ? { ...prev, email: { ...prev.email, [key]: !prev.email[key] } } : prev)}
                  style={{
                    width: 36, height: 20, borderRadius: 999,
                    background: settings.email[key] ? "#7c3aed" : "#222",
                    position: "relative", transition: "background 0.2s", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: settings.email[key] ? 19 : 3,
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    transition: "left 0.15s",
                  }} />
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            style={{ marginTop: 14, padding: "8px 20px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {savingSettings ? "Se salvează..." : "Salvează setări"}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", overflowX: "auto" }}>
        {(["all", "visitor", "lead", "subscribe", "offer_viewed", "seo_visit"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 14px", border: "none", borderBottom: `2px solid ${filter === f ? "#7c3aed" : "transparent"}`,
              background: "none", color: filter === f ? "#a78bfa" : "#555", fontSize: 12, fontWeight: filter === f ? 600 : 400,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
            }}
          >
            {f === "all" ? "Toate" : TYPE_LABEL[f]}
            {f !== "all" && (
              <span style={{ marginLeft: 5, fontSize: 10, color: "#444" }}>
                {activities.filter((a) => a.type === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity list */}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#333", fontSize: 13 }}>Se încarcă...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ fontSize: 24, margin: "0 0 8px" }}>📭</p>
            <p style={{ color: "#333", fontSize: 13 }}>Nicio activitate</p>
          </div>
        ) : (
          filtered.map((activity) => (
            <div
              key={activity.id}
              onClick={() => { if (!activity.read) markRead(activity.id); }}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 18px",
                background: activity.read ? "transparent" : "#0d0d18",
                borderBottom: "1px solid #111",
                cursor: activity.read ? "default" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {/* Icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${TYPE_COLOR[activity.type]}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>
                {TYPE_ICON[activity.type]}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  {!activity.read && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLOR[activity.type], flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: activity.read ? 400 : 600, color: activity.read ? "#888" : "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activity.title}
                  </span>
                </div>
                {activity.description && (
                  <p style={{ fontSize: 11, color: "#555", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activity.description}
                  </p>
                )}
              </div>

              {/* Right side */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: "#444" }}>{timeAgo(activity.createdAt?.seconds)}</span>
                {activity.emailSent && (
                  <span style={{ fontSize: 9, color: "#374151", background: "#1f2937", borderRadius: 4, padding: "1px 5px" }}>email</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 18px", borderTop: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#333" }}>Actualizare automată la 30s</span>
        <button onClick={fetchActivities} style={{ fontSize: 10, color: "#555", background: "none", border: "none", cursor: "pointer" }}>
          ↻ Reîncarcă
        </button>
      </div>
    </div>
  );
}
