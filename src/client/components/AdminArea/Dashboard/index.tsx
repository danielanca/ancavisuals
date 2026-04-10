import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientEvent, AdminSettings } from "../../../types/admin";
import GoalCard from "../GoalCard";
import EventList from "../EventList";
import useAuth from "../../../hooks/useAuth";
import AncaLoader from "../../UI/AncaLoader";

const DEFAULT_SETTINGS: AdminSettings = {
  goals: {
    sixMonths: { targetRevenue: 15000, startDate: "2026-04-01", endDate: "2026-09-30" },
    oneYear: { targetRevenue: 30000, startDate: "2026-01-01", endDate: "2026-12-31" },
  },
  currency: "EUR",
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logOut } = useAuth();

  const handleLogout = async () => {
    await logOut();
    navigate("/login", { replace: true });
  };
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
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

  const handleAddEvent = () => navigate("/admin/create-event");

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
              Bună, Dani 👋
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
          <GoalCard title="Goal 6 Luni" goal={settings.goals.sixMonths} events={events} />
          <GoalCard title="Goal 1 An" goal={settings.goals.oneYear} events={events} />
        </div>

        {/* Event List */}
        <EventList events={events} onAddEvent={handleAddEvent} />

      </div>
    </div>
  );
};

export default Dashboard;
