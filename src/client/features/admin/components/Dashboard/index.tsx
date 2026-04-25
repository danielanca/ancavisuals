import React, { useEffect, useState } from "react";
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
import ModeratorAlbumsPage from "../Moderation/ModeratorAlbumsPage";

const LOGIN_ROUTE = "/login";
const CREATE_EVENT_ROUTE = "/admin/create-event";
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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logOut } = useAuth();

  const targetEventId =
    typeof (location.state as { scrollToEvent?: unknown } | null)?.scrollToEvent === "string"
      ? (location.state as { scrollToEvent: string }).scrollToEvent
      : undefined;

  const handleLogout = async () => {
    await logOut();
    navigate(LOGIN_ROUTE, { replace: true });
  };

  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [urgentMementos, setUrgentMementos] = useState(0);
  const [pendingModerationCount, setPendingModerationCount] = useState(0);
  const [unseenErrorsCount, setUnseenErrorsCount] = useState(0);
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);

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
          (eventsData.events ?? []).map((event: ClientEvent & { eventDate: string | null; eventEndDate?: string | null; createdAt: string }) => ({
            ...event,
            fiscalized: event.fiscalized === true,
            eventDate: event.eventDate ? new Date(event.eventDate) : null,
            eventEndDate: event.eventEndDate ? new Date(event.eventEndDate) : null,
            createdAt: new Date(event.createdAt),
          })),
        );
        if (!settingsData.error) setSettings(normalizeSettings(settingsData));
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));

    fetch("/api/admin/mementos")
      .then((r) => r.json())
      .then((d) => {
        const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const urgent = (d.mementos ?? []).filter((m: { completed: boolean; dueDate: string }) =>
          !m.completed && new Date(m.dueDate) <= in48h
        ).length;
        setUrgentMementos(urgent);
      })
      .catch(() => {});

    if (auth.accessToken) {
      fetch("/api/moderare/pending-count", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
        .then((r) => r.json())
        .then((d: { pendingCount?: number }) => setPendingModerationCount(d.pendingCount ?? 0))
        .catch(() => {});

      fetch("/api/inspiration-proposals/admin/pending-count", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      })
        .then((r) => r.json())
        .then((d: { pendingCount?: number }) => setPendingProposalsCount(d.pendingCount ?? 0))
        .catch(() => {});
    }

    fetch("/api/admin/monitoring/errors/unseen-count")
      .then((r) => r.json())
      .then((data: { count?: number }) => setUnseenErrorsCount(data.count ?? 0))
      .catch(() => {});
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

  return (
    <>
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">
              {DASHBOARD_HEADING}
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Iată ce urmează în {new Date().getFullYear()}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 text-xs hover:border-red-500/50 hover:text-red-400 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Deconectare
          </button>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/admin/create-event")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Eveniment nou
          </button>
          <button
            onClick={() => navigate("/admin/calendar")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Calendar
          </button>
          <button
            onClick={() => navigate("/admin/contracts")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Contracte
          </button>
          <button
            onClick={() => navigate("/admin/bank-details")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 15h4" />
            </svg>
            Detalii bancare
          </button>
          <button
            onClick={() => navigate("/admin/inspiration")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Inspirație
            {pendingProposalsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white leading-none">
                {pendingProposalsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/admin/mementos")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
            Mementouri
            {urgentMementos > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white leading-none">
                {urgentMementos}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/admin/media-activity")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            Activitate Media
          </button>
          <button
            onClick={() => navigate("/admin/image-optimizer")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
              <path d="M15 9l2 2-2 2" />
            </svg>
            Optimizare Poze
          </button>
          <button
            onClick={() => navigate("/admin/moderare")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
              <circle cx="19" cy="6" r="3" fill="currentColor" stroke="none" />
            </svg>
            Moderare
            {pendingModerationCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-black leading-none">
                {pendingModerationCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/admin/errors")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-neutral-800 text-neutral-400 rounded-lg hover:border-neutral-600 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Erori
            {unseenErrorsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-500 text-white leading-none">
                {unseenErrorsCount}
              </span>
            )}
          </button>
        </div>

        {/* Post-event follow-up notifications */}
        <PostEventFollowUp events={events} onEventUpdated={handleEventUpdated} />

        {/* Goal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GoalCard title={SIX_MONTHS_GOAL_TITLE} goal={settings.goals.sixMonths} events={events} editableRange detailRoute="/admin/goals/six-months" onGoalUpdate={(u) => handleGoalUpdate("sixMonths", u)} />
          <GoalCard title={ONE_YEAR_GOAL_TITLE} goal={settings.goals.oneYear} events={events} detailRoute="/admin/goals/one-year" onGoalUpdate={(u) => handleGoalUpdate("oneYear", u)} />
        </div>

        {/* Financial Summary */}
        <FinancialSummary events={events} />

        {/* Mementos Widget */}
        <MementosWidget />

        {/* Event List */}
        <EventList
          events={events}
          targetEventId={targetEventId}
          onAddEvent={handleAddEvent}
          onEventUpdated={handleEventUpdated}
          onEventDeleted={handleEventDeleted}
        />

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

export default Dashboard;
