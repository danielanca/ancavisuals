import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ClientEvent, AdminSettings } from "../../types";
import GoalCard from "../GoalCard";
import EventList from "../EventList";
import AddLeadModal from "../AddLeadModal";
import FinancialSummary from "../FinancialSummary";
import useAuth from "../../auth/useAuth";
import AncaLoader from "../../../../components/UI/AncaLoader";
import PostEventFollowUp from "../PostEventFollowUp";
import MementosWidget from "../MementosWidget";
import ActivityInbox from "../ActivityInbox";
import NextEventCountdown from "../NextEventCountdown";
import ModeratorAlbumsPage from "../Moderation/ModeratorAlbumsPage";
import { PrivacyModeProvider, usePrivacyMode } from "../../context/PrivacyModeContext";
import AlbumHealthWidget from "../AlbumHealthWidget";

// ── Dashboard Search ──────────────────────────────────────────────────────────

type SearchItem = { label: string; path: string; category: string; keywords?: string };

const SEARCH_ITEMS: SearchItem[] = [
  { label: "Calendar", path: "/admin/calendar", category: "Evenimente" },
  { label: "Mementouri", path: "/admin/mementos", category: "Evenimente" },
  { label: "Moderare albume", path: "/admin/moderare", category: "Evenimente" },
  { label: "Foi de parcurs", path: "/admin/route-sheets", category: "Evenimente" },
  { label: "Contracte", path: "/admin/contracts", category: "Contracte & Oferte" },
  { label: "Oferte", path: "/admin/oferte", category: "Contracte & Oferte" },
  { label: "Template Oferte", path: "/admin/template-oferte", category: "Contracte & Oferte" },
  { label: "Propuneri Media", path: "/admin/instagram-proposals", category: "Media", keywords: "instagram propuneri poze" },
  { label: "Media Assets", path: "/admin/media-assets", category: "Media", keywords: "assets imagini fisiere" },
  { label: "QR Moments", path: "/admin/qr-moments", category: "Media" },
  { label: "Activitate album", path: "/admin/media-activity", category: "Media" },
  { label: "Optimizare poze", path: "/admin/image-optimizer", category: "Media", keywords: "optimizare imagini compresie" },
  { label: "Rezumat financiar", path: "/admin/financial", category: "Financiar", keywords: "bani venituri cheltuieli" },
  { label: "Extrase bancare", path: "/admin/bank-statements", category: "Financiar" },
  { label: "Detalii bancare", path: "/admin/bank-details", category: "Financiar", keywords: "iban cont" },
  { label: "Inspirație", path: "/admin/inspiration", category: "Marketing & Web" },
  { label: "Analytics", path: "/admin/analytics", category: "Marketing & Web" },
  { label: "Zone Showcase", path: "/admin/showcase", category: "Marketing & Web", keywords: "banner reclama footer poze showcase" },
  { label: "Conturi", path: "/admin/accounts", category: "Sistem" },
  { label: "Wedding Hub", path: "/admin/wedding-hub", category: "Sistem" },
  { label: "Erori server", path: "/admin/errors", category: "Sistem", keywords: "logs erori bugs" },
];

function DashboardSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = query.trim().length === 0 ? [] : SEARCH_ITEMS.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.keywords ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => { setActiveIndex(0); }, [query]);

  const goTo = useCallback((path: string) => {
    setQuery("");
    setFocused(false);
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setQuery(""); setFocused(false); }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIndex]) goTo(results[activeIndex].path);
  };

  const showDropdown = focused && results.length > 0;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <svg
          style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Caută rapid... (⌘K)"
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
            background: "#111",
            border: `1px solid ${focused ? "#333" : "#1a1a1a"}`,
            borderRadius: "10px",
            color: "#ccc",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "2px" }}
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
          background: "#111", border: "1px solid #222", borderRadius: "10px",
          overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {results.map((item, i) => (
            <button
              key={item.path}
              onMouseDown={() => goTo(item.path)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "10px 14px", background: i === activeIndex ? "#1a1a1a" : "transparent",
                border: "none", borderBottom: i < results.length - 1 ? "1px solid #1a1a1a" : "none",
                color: "#fff", fontSize: "14px", textAlign: "left", cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span>{item.label}</span>
              <span style={{ fontSize: "11px", color: "#555", whiteSpace: "nowrap", marginLeft: "12px" }}>{item.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Widget Order ──────────────────────────────────────────────────────────

const DEFAULT_WIDGET_ORDER = ["goals", "financial", "countdown", "activity", "albumHealth", "mementos", "events"];
const WIDGET_ORDER_KEY = "dashboard_widget_order";

function useDashboardWidgetOrder() {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_ORDER_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const valid = parsed.filter(id => DEFAULT_WIDGET_ORDER.includes(id));
        const missing = DEFAULT_WIDGET_ORDER.filter(id => !valid.includes(id));
        return [...valid, ...missing];
      }
    } catch {}
    return [...DEFAULT_WIDGET_ORDER];
  });

  const reorder = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(sourceId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, sourceId);
      try { localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { order, reorder };
}

// ── Grip Icon ──────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="3" r="1.3" />
      <circle cx="10" cy="3" r="1.3" />
      <circle cx="4" cy="7" r="1.3" />
      <circle cx="10" cy="7" r="1.3" />
      <circle cx="4" cy="11" r="1.3" />
      <circle cx="10" cy="11" r="1.3" />
    </svg>
  );
}

// ── Draggable Widget ──────────────────────────────────────────────────────────

interface DraggableWidgetProps {
  id: string;
  isDragging: boolean;
  isAnyDragging: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (id: string) => void;
  onDrop: (sourceId: string, targetId: string) => void;
  children: React.ReactNode;
}

function DraggableWidget({ id, isDragging, isAnyDragging, isDragOver, onDragStart, onDragEnd, onDragOver, onDrop, children }: DraggableWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleHandleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    onDragStart(id);

    let currentOverId: string | null = null;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
      const touch = moveEvent.touches[0];

      if (containerRef.current) containerRef.current.style.pointerEvents = "none";
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      if (containerRef.current) containerRef.current.style.pointerEvents = "";

      const widgetEl = elementBelow?.closest("[data-widget-id]") as HTMLElement | null;
      const overId = widgetEl?.getAttribute("data-widget-id") ?? null;
      if (overId !== currentOverId) {
        currentOverId = overId;
        if (overId) onDragOver(overId);
      }
    };

    const handleTouchEnd = () => {
      if (currentOverId && currentOverId !== id) onDrop(id, currentOverId);
      else onDragEnd();
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  }, [id, onDragStart, onDragEnd, onDragOver, onDrop]);

  return (
    <div
      ref={containerRef}
      data-widget-id={id}
      style={{
        position: "relative",
        opacity: isDragging ? 0.35 : 1,
        outline: isDragOver && !isDragging ? "2px solid rgba(255,255,255,0.18)" : "2px solid transparent",
        outlineOffset: "3px",
        borderRadius: "12px",
        transition: "opacity 0.18s, outline-color 0.15s",
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(id); }}
      onDragLeave={(e) => {
        // Only clear dragOver if leaving the widget entirely (not entering a child)
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          onDragOver("");
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData("text/plain");
        if (sourceId && sourceId !== id) onDrop(sourceId, id);
        else onDragEnd();
      }}
    >
      {/* Drag handle */}
      <div
        draggable
        title="Trage pentru a reordona"
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          if (containerRef.current) {
            e.dataTransfer.setDragImage(containerRef.current, Math.min(containerRef.current.offsetWidth / 2, 100), 24);
          }
          onDragStart(id);
        }}
        onDragEnd={onDragEnd}
        onTouchStart={handleHandleTouchStart}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          cursor: "grab",
          color: "#444",
          padding: "6px",
          zIndex: 10,
          borderRadius: "6px",
          userSelect: "none",
          touchAction: "none",
          lineHeight: 0,
          transition: "color 0.15s, background-color 0.15s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = "#888";
          el.style.backgroundColor = "rgba(255,255,255,0.08)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.color = "#444";
          el.style.backgroundColor = "transparent";
        }}
      >
        <GripIcon />
      </div>

      {/* Transparent overlay during any drag so child elements don't intercept drop events */}
      {isAnyDragging && !isDragging && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, borderRadius: "12px" }} />
      )}
      {children}
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROBOTS_META_NAME = "robots";
const ROBOTS_META_CONTENT = "noindex, nofollow";
const DASHBOARD_HEADING = "Bună, Dani 👋";
const SIX_MONTHS_GOAL_TITLE = "Goal Personalizat";
const ONE_YEAR_GOAL_TITLE = "Goal 1 An";

const SIX_MONTHS_TARGET_REVENUE = 15000;
const SIX_MONTHS_START_DATE = "2026-04-01";
const SIX_MONTHS_END_DATE = "2026-09-30";

const ONE_YEAR_TARGET_REVENUE = 30000;
const ONE_YEAR_START_DATE = "2026-01-01";
const ONE_YEAR_END_DATE = "2026-12-31";

const DEFAULT_SETTINGS: AdminSettings = {
  goals: {
    sixMonths: {
      targetRevenue: SIX_MONTHS_TARGET_REVENUE,
      startDate: SIX_MONTHS_START_DATE,
      endDate: SIX_MONTHS_END_DATE,
    },
    oneYear: {
      targetRevenue: ONE_YEAR_TARGET_REVENUE,
      startDate: ONE_YEAR_START_DATE,
      endDate: ONE_YEAR_END_DATE,
    },
  },
  currency: "EUR",
  exchangeRate: 5.0,
  bankDetails: {
    beneficiaryName: "",
    iban: "",
  },
};


function normalizeSettings(settingsData: Partial<AdminSettings>): AdminSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settingsData,
    goals: {
      ...DEFAULT_SETTINGS.goals,
      ...settingsData.goals,
    },
    bankDetails: {
      ...DEFAULT_SETTINGS.bankDetails,
      ...settingsData.bankDetails,
    },
  };
}

// ── Dashboard Inner ──────────────────────────────────────────────────────────

const DashboardInner: React.FC = () => {
  const location = useLocation();
  const { auth } = useAuth();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();

  const targetEventId =
    typeof (location.state as { scrollToEvent?: unknown } | null)?.scrollToEvent === "string"
      ? (location.state as { scrollToEvent: string }).scrollToEvent
      : undefined;

  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  // Widget drag-and-drop state
  const { order: widgetOrder, reorder } = useDashboardWidgetOrder();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    draggingIdRef.current = id;
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((id: string) => {
    if (id) setDragOverId(id);
  }, []);

  const handleDrop = useCallback((sourceId: string, targetId: string) => {
    reorder(sourceId, targetId);
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, [reorder]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = ROBOTS_META_NAME;
    meta.content = ROBOTS_META_CONTENT;
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/events").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ])
      .then(([eventsData, settingsData]) => {
        if (eventsData.error) throw new Error(eventsData.error);
        setEvents(
          (eventsData.events ?? []).map((event: ClientEvent & {
            eventDate: string | null;
            eventEndDate?: string | null;
            createdAt: string;
            postEventBackupConfirmedAt?: string | null;
            postEventBackupReminderSentAt?: string | null;
            postEventBackupReminderDueAt?: string | null;
          }) => ({
            ...event,
            fiscalized: event.fiscalized === true,
            eventDate: event.eventDate ? new Date(event.eventDate) : null,
            eventEndDate: event.eventEndDate ? new Date(event.eventEndDate) : null,
            createdAt: new Date(event.createdAt),
            postEventBackupConfirmedAt: event.postEventBackupConfirmedAt ? new Date(event.postEventBackupConfirmedAt) : null,
            postEventBackupReminderSentAt: event.postEventBackupReminderSentAt ? new Date(event.postEventBackupReminderSentAt) : null,
            postEventBackupReminderDueAt: event.postEventBackupReminderDueAt ? new Date(event.postEventBackupReminderDueAt) : null,
          })),
        );
        if (!settingsData.error) setSettings(normalizeSettings(settingsData));
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));

  }, [auth.accessToken]);

  const handleAddEvent = () => setShowLeadModal(true);

  const handleLeadAdded = (newEvent: ClientEvent) => {
    setEvents(prev => [newEvent, ...prev]);
  };

  const handleEventUpdated = (id: string, updated: Partial<ClientEvent>) => {
    setEvents(prev =>
      prev.map(e => e.id === id ? { ...e, ...updated } : e)
    );
  };

  const handleEventDeleted = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleGoalUpdate = async (key: "sixMonths" | "oneYear", updates: { targetRevenue: number; startDate: string; endDate: string }) => {
    const updated: AdminSettings = {
      ...settings,
      goals: {
        ...settings.goals,
        [key]: { ...settings.goals[key], ...updates },
      },
    };
    setSettings(updated);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  if (auth.role === "moderator") return <ModeratorAlbumsPage />;

  if (loading) return <AncaLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Eroare: {error}</p>
      </div>
    );
  }

  const widgetMap: Record<string, React.ReactNode> = {
    goals: (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GoalCard title={SIX_MONTHS_GOAL_TITLE} goal={settings.goals.sixMonths} events={events} editableRange detailRoute="/admin/goals/six-months" onGoalUpdate={(u) => handleGoalUpdate("sixMonths", u)} open={goalsOpen} onToggle={() => setGoalsOpen(value => !value)} />
        <GoalCard title={ONE_YEAR_GOAL_TITLE} goal={settings.goals.oneYear} events={events} detailRoute="/admin/goals/one-year" onGoalUpdate={(u) => handleGoalUpdate("oneYear", u)} open={goalsOpen} onToggle={() => setGoalsOpen(value => !value)} />
      </div>
    ),
    financial: <FinancialSummary events={events} />,
    countdown: <NextEventCountdown events={events} />,
    activity: <ActivityInbox />,
    albumHealth: <AlbumHealthWidget />,
    mementos: <MementosWidget />,
    events: (
      <EventList
        events={events}
        targetEventId={targetEventId}
        onAddEvent={handleAddEvent}
        onEventUpdated={handleEventUpdated}
        onEventDeleted={handleEventDeleted}
        exchangeRate={settings.exchangeRate}
      />
    ),
  };

  return (
    <>
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-white text-2xl font-light tracking-tight">
              {DASHBOARD_HEADING}
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Iată ce urmează în {new Date().getFullYear()}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:justify-end">
            <button
              onClick={togglePrivacyMode}
              title={privacyMode ? "Arată datele" : "Ascunde datele sensibile"}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors sm:flex-none ${
                privacyMode
                  ? "border-amber-500/60 text-amber-400 bg-amber-500/10"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
              }`}
            >
              {privacyMode ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
              {privacyMode ? "Arată" : "Ascunde"}
            </button>
          </div>
        </div>

        {/* Search */}
        <DashboardSearch />

        {/* Post-event follow-up notifications */}
        <PostEventFollowUp events={events} onEventUpdated={handleEventUpdated} />

        {/* Draggable Widgets */}
        {widgetOrder.map(widgetId => (
          <DraggableWidget
            key={widgetId}
            id={widgetId}
            isDragging={draggingId === widgetId}
            isAnyDragging={draggingId !== null}
            isDragOver={dragOverId === widgetId && draggingId !== widgetId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {widgetMap[widgetId]}
          </DraggableWidget>
        ))}


      </div>
    </div>

    {showLeadModal && (
      <AddLeadModal
        onClose={() => setShowLeadModal(false)}
        onAdded={handleLeadAdded}
      />
    )}
    </>
  );
};

const Dashboard: React.FC = () => (
  <PrivacyModeProvider>
    <DashboardInner />
  </PrivacyModeProvider>
);

export default Dashboard;
