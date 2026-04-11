import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent, AdminSettings } from "../../types";
import GoalCard from "../GoalCard";
import EventList from "../EventList";
import useAuth from "../../auth/useAuth";
import AncaLoader from "../../../../components/UI/AncaLoader";

const LOGIN_ROUTE = "/login";
const CREATE_EVENT_ROUTE = "/admin/create-event";
const ROBOTS_META_NAME = "robots";
const ROBOTS_META_CONTENT = "noindex, nofollow";
const DASHBOARD_HEADING = "Bună, Dani 👋";
const SIX_MONTHS_GOAL_TITLE = "Goal 6 Luni";
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
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logOut } = useAuth();

  const handleLogout = async () => {
    await logOut();
    navigate(LOGIN_ROUTE, { replace: true });
  };
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          (eventsData.events ?? []).map((event: ClientEvent & { eventDate: string; createdAt: string }) => ({
            ...event,
            eventDate: new Date(event.eventDate),
            createdAt: new Date(event.createdAt),
          })),
        );
        if (!settingsData.error) setSettings(settingsData);
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAddEvent = () => navigate(CREATE_EVENT_ROUTE);

  const handleEventUpdated = (id: string, updated: Partial<ClientEvent>) => {
    setEvents(prev =>
      prev.map(e => e.id === id ? { ...e, ...updated } : e)
    );
  };

  if (loading) return <AncaLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Eroare: {error}</p>
      </div>
    );
  }

  return (
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

        {/* Goal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GoalCard title={SIX_MONTHS_GOAL_TITLE} goal={settings.goals.sixMonths} events={events} />
          <GoalCard title={ONE_YEAR_GOAL_TITLE} goal={settings.goals.oneYear} events={events} />
        </div>

        {/* Event List */}
        <EventList events={events} onAddEvent={handleAddEvent} onEventUpdated={handleEventUpdated} />

      </div>
    </div>
  );
};

export default Dashboard;
