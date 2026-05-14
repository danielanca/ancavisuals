import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { PrivacyModeProvider, usePrivacyMode } from "../../context/PrivacyModeContext";

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

const quickNavButtonClass =
  "flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2.5 text-center text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white sm:min-h-0 sm:w-auto sm:justify-start sm:px-4 sm:py-2";

const quickNavPrimaryButtonClass =
  "flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-2.5 text-center text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 hover:text-emerald-300 sm:min-h-0 sm:w-auto sm:justify-start sm:px-4 sm:py-2";

type QuickNavItem = {
  key: string;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: number;
  primary?: boolean;
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

const DashboardInner: React.FC = () => {
  const navigate = useNavigate();
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
  const [urgentMementos, setUrgentMementos] = useState(0);
  const [pendingModerationCount, setPendingModerationCount] = useState(0);
  const [unseenErrorsCount, setUnseenErrorsCount] = useState(0);
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
  const [showMoreQuickActions, setShowMoreQuickActions] = useState(false);
  const [quickNavOrder, setQuickNavOrder] = useState<string[]>([]);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [liveOrder, setLiveOrder] = useState<string[]>([]);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const wasDraggingRef = useRef(false);
  const displayedKeysRef = useRef<string[]>([]);
  const liveOrderRef = useRef<string[]>([]);

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

    fetch("/api/admin/monitoring/errors/unseen-count", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data: { count?: number }) => setUnseenErrorsCount(data.count ?? 0))
      .catch(() => {});

  }, [auth.accessToken]);

  useEffect(() => {
    fetch("/api/admin/ui-state")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.quickNavOrder)) setQuickNavOrder(data.quickNavOrder); })
      .catch(() => {});
  }, []);

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

  const quickNavItems = useMemo<QuickNavItem[]>(() => [
    {
      key: "create-event",
      label: "Eveniment nou",
      onClick: () => navigate("/admin/create-event"),
      primary: true,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      key: "calendar",
      label: "Calendar",
      onClick: () => navigate("/admin/calendar"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      key: "contracts",
      label: "Contracte",
      onClick: () => navigate("/admin/contracts"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      key: "mementos",
      label: "Mementouri",
      onClick: () => navigate("/admin/mementos"),
      badge: urgentMementos,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      ),
    },
    {
      key: "errors",
      label: "Erori",
      onClick: () => navigate("/admin/errors"),
      badge: unseenErrorsCount,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    },
    {
      key: "qr-moments",
      label: "QR Moments",
      onClick: () => navigate("/admin/qr-moments"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="3" width="5" height="5" />
          <rect x="16" y="3" width="5" height="5" />
          <rect x="3" y="16" width="5" height="5" />
          <path d="M16 16h2v2h-2z" />
          <path d="M20 16h1v5h-5v-1" />
          <path d="M10 5h4M10 12h2M12 8v4M5 10v4M8 12h2M14 10h5M16 12v2" />
        </svg>
      ),
    },
    {
      key: "bank-details",
      label: "Detalii bancare",
      onClick: () => navigate("/admin/bank-details"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      ),
    },
    {
      key: "instagram-proposals",
      label: "Propuneri Media",
      onClick: () => navigate("/admin/instagram-proposals"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      key: "media-assets",
      label: "Media Assets",
      onClick: () => navigate("/admin/media-assets"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      key: "template-oferte",
      label: "Template Oferte",
      onClick: () => navigate("/admin/template-oferte"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      ),
    },
    {
      key: "inspiration",
      label: "Inspirație",
      onClick: () => navigate("/admin/inspiration"),
      badge: pendingProposalsCount,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      key: "media-activity",
      label: "Activitate Media",
      onClick: () => navigate("/admin/media-activity"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      key: "image-optimizer",
      label: "Optimizare Poze",
      onClick: () => navigate("/admin/image-optimizer"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
          <path d="M15 9l2 2-2 2" />
        </svg>
      ),
    },
    {
      key: "moderare",
      label: "Moderare",
      onClick: () => navigate("/admin/moderare"),
      badge: pendingModerationCount,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M3 6h18M3 12h18M3 18h18" />
          <circle cx="19" cy="6" r="3" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      key: "financial",
      label: "Financiar",
      onClick: () => navigate("/admin/financial"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      key: "bank-statements",
      label: "Extrase cont",
      onClick: () => navigate("/admin/bank-statements"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="16" x2="13" y2="16" />
        </svg>
      ),
    },
    {
      key: "accounts",
      label: "Conturi",
      onClick: () => navigate("/admin/accounts"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      key: "route-sheets",
      label: "Foi de parcurs",
      onClick: () => navigate("/admin/route-sheets"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M3 12h18M3 6h18M3 18h12" />
          <circle cx="19" cy="18" r="2" />
          <path d="M17 18H3" />
        </svg>
      ),
    },
    {
      key: "oferte",
      label: "Oferte",
      onClick: () => navigate("/admin/oferte"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      key: "wedding-hub",
      label: "Wedding Hub",
      onClick: () => navigate("/admin/wedding-hub"),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ),
    },
  ], [navigate, pendingModerationCount, pendingProposalsCount, unseenErrorsCount, urgentMementos]);

  const displayedQuickNavItems = useMemo(() => {
    const effectiveOrder = liveOrder.length ? liveOrder : quickNavOrder;
    if (!effectiveOrder.length) return quickNavItems;
    const orderMap = new Map(effectiveOrder.map((key, index) => [key, index]));
    return [...quickNavItems].sort((itemA, itemB) => {
      const indexA = orderMap.get(itemA.key) ?? quickNavItems.length;
      const indexB = orderMap.get(itemB.key) ?? quickNavItems.length;
      return indexA - indexB;
    });
  }, [quickNavItems, quickNavOrder, liveOrder]);

  useEffect(() => {
    displayedKeysRef.current = displayedQuickNavItems.map((item) => item.key);
  }, [displayedQuickNavItems]);

  useEffect(() => {
    liveOrderRef.current = liveOrder;
  }, [liveOrder]);

  // Document-level listeners active only while dragging
  useEffect(() => {
    if (!draggingKey) return;

    const handleMove = (e: PointerEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const navEl = target?.closest("[data-navkey]");
      const targetKey = navEl?.getAttribute("data-navkey");
      if (!targetKey || targetKey === draggingKey) return;
      setLiveOrder((prev) => {
        const next = [...prev];
        const fromIndex = next.indexOf(draggingKey);
        const toIndex = next.indexOf(targetKey);
        if (fromIndex === -1 || toIndex === -1) return prev;
        next.splice(fromIndex, 1);
        next.splice(toIndex, 0, draggingKey);
        return next;
      });
    };

    const handleUp = () => {
      const finalOrder = liveOrderRef.current;
      if (finalOrder.length) {
        wasDraggingRef.current = true;
        setTimeout(() => { wasDraggingRef.current = false; }, 50);
        setQuickNavOrder(finalOrder);
        fetch("/api/admin/ui-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quickNavOrder: finalOrder }),
        }).catch(() => {});
      }
      setDraggingKey(null);
      setLiveOrder([]);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };
  }, [draggingKey]);

  const handleNavPointerDown = (key: string, e: React.PointerEvent) => {
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    const cancelIfMoved = (ev: PointerEvent) => {
      if (!pointerStartPosRef.current) return;
      const dx = ev.clientX - pointerStartPosRef.current.x;
      const dy = ev.clientY - pointerStartPosRef.current.y;
      if (dx * dx + dy * dy > 100) {
        if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        document.removeEventListener("pointermove", cancelIfMoved);
      }
    };
    document.addEventListener("pointermove", cancelIfMoved);

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      document.removeEventListener("pointermove", cancelIfMoved);
      setDraggingKey(key);
      setLiveOrder([...displayedKeysRef.current]);
    }, 280);
  };

  const mobilePrimaryQuickNavItems = displayedQuickNavItems.slice(0, 6);
  const mobileSecondaryQuickNavItems = displayedQuickNavItems.slice(6);

  const renderQuickNavButton = (item: QuickNavItem) => {
    const isDragging = draggingKey === item.key;
    const isDragActive = draggingKey !== null;
    return (
      <button
        key={item.key}
        data-navkey={item.key}
        onClick={() => { if (!wasDraggingRef.current) item.onClick(); }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => handleNavPointerDown(item.key, e)}
        className={`${item.primary ? quickNavPrimaryButtonClass : quickNavButtonClass} transition-all ${isDragging ? "opacity-40 scale-95 ring-2 ring-white/20" : ""}`}
        style={{ touchAction: isDragActive ? "none" : "auto", userSelect: "none", cursor: isDragActive ? "grabbing" : "pointer" }}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
        {!!item.badge && (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${item.key === "errors" || item.key === "mementos" ? "bg-red-500 text-white" : item.key === "moderare" ? "bg-amber-500 text-black" : "bg-amber-500 text-white"}`}>
            {item.badge}
          </span>
        )}
      </button>
    );
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

        {/* Quick nav */}
        <div className="space-y-2 sm:space-y-0">
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {mobilePrimaryQuickNavItems.map(renderQuickNavButton)}
          </div>

          {showMoreQuickActions && (
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {mobileSecondaryQuickNavItems.map(renderQuickNavButton)}
            </div>
          )}

          <button
            onClick={() => setShowMoreQuickActions((previous) => !previous)}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white sm:hidden"
          >
            <span>{showMoreQuickActions ? "Mai puține" : "Mai multe"}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${showMoreQuickActions ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div className="hidden flex-wrap gap-2 sm:flex">
            {displayedQuickNavItems.map(renderQuickNavButton)}
          </div>
        </div>

        {/* Post-event follow-up notifications */}
        <PostEventFollowUp events={events} onEventUpdated={handleEventUpdated} />

        {/* Goal Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GoalCard title={SIX_MONTHS_GOAL_TITLE} goal={settings.goals.sixMonths} events={events} editableRange detailRoute="/admin/goals/six-months" onGoalUpdate={(u) => handleGoalUpdate("sixMonths", u)} open={goalsOpen} onToggle={() => setGoalsOpen(value => !value)} />
          <GoalCard title={ONE_YEAR_GOAL_TITLE} goal={settings.goals.oneYear} events={events} detailRoute="/admin/goals/one-year" onGoalUpdate={(u) => handleGoalUpdate("oneYear", u)} open={goalsOpen} onToggle={() => setGoalsOpen(value => !value)} />
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

const Dashboard: React.FC = () => (
  <PrivacyModeProvider>
    <DashboardInner />
  </PrivacyModeProvider>
);

export default Dashboard;
