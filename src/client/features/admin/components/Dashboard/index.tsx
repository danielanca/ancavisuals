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
import DeliveryDeadlineOverview from "../DeliveryDeadlineOverview";
import DashboardSearch from "../DashboardSearch";

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
  bankProfiles: [],
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

        <DeliveryDeadlineOverview events={events} onEventUpdated={handleEventUpdated} />

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
