import React, { useEffect, useState, useCallback } from "react";
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
import EmailFailureBanner from "../EmailFailureBanner";
import ActivityInbox from "../ActivityInbox";
import LeadsWidget from "../LeadsWidget";
import NextEventCountdown from "../NextEventCountdown";
import ModeratorAlbumsPage from "../Moderation/ModeratorAlbumsPage";
import { PrivacyModeProvider, usePrivacyMode } from "../../context/PrivacyModeContext";
import AlbumHealthWidget from "../AlbumHealthWidget";
import DeliveryDeadlineOverview from "../DeliveryDeadlineOverview";
import DashboardSearch from "../DashboardSearch";

// ── Widget Order ──────────────────────────────────────────────────────────

const DEFAULT_WIDGET_ORDER = ["leads", "activity", "goals", "financial", "countdown", "albumHealth", "mementos", "events", "deadlines"];
const WIDGET_ORDER_KEY = "dashboard_widget_order";

function useDashboardWidgetOrder() {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_ORDER_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const merged = parsed.filter(id => DEFAULT_WIDGET_ORDER.includes(id));
        // A widget added after the order was saved goes to its default slot, not the bottom.
        DEFAULT_WIDGET_ORDER.forEach((id, index) => {
          if (!merged.includes(id)) merged.splice(Math.min(index, merged.length), 0, id);
        });
        return merged;
      }
    } catch {}
    return [...DEFAULT_WIDGET_ORDER];
  });

  const move = useCallback((id: string, direction: -1 | 1) => {
    setOrder(prev => {
      const from = prev.indexOf(id);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      try { localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { order, move };
}

// ── Reorderable Widget ──────────────────────────────────────────────────────────

interface ReorderableWidgetProps {
  id: string;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  onMove: (id: string, direction: -1 | 1) => void;
  children: React.ReactNode;
}

const MOVE_BUTTON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-md text-amber-400 transition-colors hover:bg-amber-500/15 hover:text-amber-300 disabled:pointer-events-none disabled:opacity-25";

// Arrows only show in "Ordine" mode — several widgets keep their own buttons in
// the top-right corner, which permanent arrows would cover.
function ReorderableWidget({ id, isFirst, isLast, editing, onMove, children }: ReorderableWidgetProps) {
  if (!editing) return <div data-widget-id={id}>{children}</div>;
  return (
    <div data-widget-id={id} className="relative rounded-2xl outline-dashed outline-1 outline-offset-4 outline-amber-500/40">
      <div className="absolute right-2.5 top-2.5 z-20 flex gap-0.5 rounded-lg border border-amber-500/40 bg-neutral-950/95 p-0.5 shadow-lg">
        <button type="button" className={MOVE_BUTTON_CLASS} disabled={isFirst} onClick={() => onMove(id, -1)} title="Mută mai sus" aria-label="Mută mai sus">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 2.5 11 9H1z" /></svg>
        </button>
        <button type="button" className={MOVE_BUTTON_CLASS} disabled={isLast} onClick={() => onMove(id, 1)} title="Mută mai jos" aria-label="Mută mai jos">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 9.5 1 3h10z" /></svg>
        </button>
      </div>
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

  const { order: widgetOrder, move: moveWidget } = useDashboardWidgetOrder();
  const [reorderMode, setReorderMode] = useState(false);

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

  if (loading) return <><EmailFailureBanner accessToken={auth.accessToken ?? ""} /><AncaLoader /></>;

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <EmailFailureBanner accessToken={auth.accessToken ?? ""} />
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
    leads: <LeadsWidget />,
    activity: <ActivityInbox />,
    albumHealth: <AlbumHealthWidget />,
    mementos: <MementosWidget />,
    deadlines: <DeliveryDeadlineOverview events={events} onEventUpdated={handleEventUpdated} />,
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
        <EmailFailureBanner accessToken={auth.accessToken ?? ""} />

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
            <button
              type="button"
              onClick={() => setReorderMode(value => !value)}
              title={reorderMode ? "Gata cu reordonarea" : "Schimbă ordinea blocurilor"}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors sm:flex-none ${
                reorderMode
                  ? "border-amber-500/60 text-amber-400 bg-amber-500/10"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
              </svg>
              {reorderMode ? "Gata" : "Ordine"}
            </button>
          </div>
        </div>

        {/* Search */}
        <DashboardSearch />

        {/* Post-event follow-up notifications */}
        <PostEventFollowUp events={events} onEventUpdated={handleEventUpdated} />

        {/* Reorderable Widgets */}
        {widgetOrder.map((widgetId, index) => (
          <ReorderableWidget
            key={widgetId}
            id={widgetId}
            isFirst={index === 0}
            isLast={index === widgetOrder.length - 1}
            editing={reorderMode}
            onMove={moveWidget}
          >
            {widgetMap[widgetId]}
          </ReorderableWidget>
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
