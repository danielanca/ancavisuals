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

// ── Dashboard Search ──────────────────────────────────────────────────────────

type SearchItem = { label: string; path: string; category: string; icon: string; keywords?: string };

const SEARCH_ITEMS: SearchItem[] = [
  // Evenimente
  { label: "Calendar", path: "/admin/calendar", category: "Evenimente", icon: "📅" },
  { label: "Mementouri", path: "/admin/mementos", category: "Evenimente", icon: "🔔", keywords: "remindere notificari" },
  { label: "Moderare albume", path: "/admin/moderare", category: "Evenimente", icon: "🖼️", keywords: "album moderat aprobare" },
  // Contracte & Oferte
  { label: "Contracte", path: "/admin/contracts", category: "Contracte & Oferte", icon: "📝", keywords: "semnat client acord" },
  { label: "Oferte", path: "/admin/oferte", category: "Contracte & Oferte", icon: "💼", keywords: "pret pachet propunere" },
  { label: "Template Oferte", path: "/admin/template-oferte", category: "Contracte & Oferte", icon: "📋", keywords: "sablon model oferta" },
  // Media
  { label: "Propuneri Media", path: "/admin/instagram-proposals", category: "Media", icon: "📸", keywords: "instagram propuneri poze social" },
  { label: "Media Assets", path: "/admin/media-assets", category: "Media", icon: "🗂️", keywords: "assets imagini fisiere resurse" },
  { label: "QR Moments", path: "/admin/qr-moments", category: "Media", icon: "🔲", keywords: "qr cod scanare moment" },
  { label: "Activitate album", path: "/admin/media-activity", category: "Media", icon: "📊", keywords: "vizualizari descarcare activitate" },
  { label: "Optimizare poze", path: "/admin/image-optimizer", category: "Media", icon: "⚡", keywords: "compresie webp optimizare imagini" },
  { label: "Sănătate albume", path: "/admin/album-health", category: "Media", icon: "💊", keywords: "zip webp status album health" },
  // Evenimente
  { label: "Progres Evenimente", path: "/admin/progress", category: "Evenimente", icon: "📋", keywords: "progres editare livrare fotografiere etape status" },
  // Financiar
  { label: "Rezumat financiar", path: "/admin/financial", category: "Financiar", icon: "💰", keywords: "bani venituri cheltuieli profit facturi cheltuieli invoices expenses" },
  { label: "Extrase bancare", path: "/admin/bank-statements", category: "Financiar", icon: "🏦", keywords: "extras cont tranzactii" },
  { label: "Detalii bancare", path: "/admin/bank-details", category: "Financiar", icon: "💳", keywords: "iban cont bancar" },
  // Marketing & Web
  { label: "Inspirație", path: "/admin/inspiration", category: "Marketing & Web", icon: "✨", keywords: "moodboard idei stil" },
  { label: "Analytics", path: "/admin/analytics", category: "Marketing & Web", icon: "📈", keywords: "vizitatori trafic statistici seo" },
  { label: "Zone Showcase", path: "/admin/showcase", category: "Marketing & Web", icon: "🖥️", keywords: "banner reclama footer homepage" },
  { label: "SEO Generator", path: "/admin/seo-generator", category: "Marketing & Web", icon: "🔍", keywords: "seo meta titlu descriere" },
  { label: "Campanii", path: "/admin/campanii", category: "Marketing & Web", icon: "📣", keywords: "campanie marketing email newsletter" },
  { label: "Propuneri Venue", path: "/admin/venue-outreach", category: "Marketing & Web", icon: "🏛️", keywords: "locatie salon partener" },
  { label: "Colecții foto", path: "/admin/colectii", category: "Media", icon: "🗃️", keywords: "colectie galerie foto organizare" },
  { label: "Propuneri Swipe", path: "/admin/swipe-proposals", category: "Media", icon: "👆", keywords: "swipe propuneri selectie" },
  // Sistem & Conturi
  { label: "Setări firmă", path: "/admin/settings", category: "Sistem", icon: "⚙️", keywords: "setari firma pfa cif iban adresa facturare serie fiscal date emitent" },
  { label: "Conturi", path: "/admin/accounts", category: "Sistem", icon: "👥", keywords: "utilizatori acces cont admin" },
  { label: "Contacte", path: "/admin/contacte", category: "Sistem", icon: "📇", keywords: "contacte clienti leads crm" },
  { label: "Echipamente", path: "/admin/echipamente", category: "Sistem", icon: "🎛️", keywords: "echipamente camera obiectiv gear" },
  { label: "Wedding Hub", path: "/admin/wedding-hub", category: "Sistem", icon: "💍", keywords: "nunta invitati rsvp plan mese" },
  { label: "Erori server", path: "/admin/errors", category: "Sistem", icon: "🐛", keywords: "logs erori bugs debug" },
  { label: "Health Tracker", path: "/admin/sanatate", category: "Sistem", icon: "❤️", keywords: "sanatate greutate pasi mancare calorii health" },
];

const RECENTS_KEY = "dash_search_recents";
const MAX_RESULTS = 8;
const MAX_RECENTS = 5;

function norm(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function scoreToken(token: string, targetWords: string[], fullText: string): number {
  if (!token) return 0;

  // Exact word match
  if (targetWords.includes(token)) return 100;
  // Word starts with token
  if (targetWords.some((w) => w.startsWith(token))) return 80;
  // Full text contains token as substring
  if (fullText.includes(token)) return 60;

  // Fuzzy match on individual words (only for tokens >= 3 chars)
  if (token.length >= 3) {
    let best = 0;
    for (const word of targetWords) {
      if (Math.abs(word.length - token.length) > 2) continue;
      const dist = levenshtein(token, word);
      // Allow 1 typo for short tokens, 2 for longer ones
      const maxDist = token.length <= 4 ? 1 : 2;
      if (dist <= maxDist) {
        best = Math.max(best, 40 - dist * 10);
      }
    }
    return best;
  }

  return 0;
}

function scoreItem(item: SearchItem, q: string): number {
  const query = norm(q.trim());
  if (!query) return 0;

  const labelNorm  = norm(item.label);
  const catNorm    = norm(item.category);
  const kwNorm     = norm(item.keywords ?? "");

  // Exact full label match
  if (labelNorm === query) return 200;

  // Build combined text and word lists per field
  const labelWords = labelNorm.split(/\s+/);
  const catWords   = catNorm.split(/\s+/);
  const kwWords    = kwNorm.split(/\s+/);

  // Split query into tokens and score each
  const tokens = query.split(/\s+/).filter(Boolean);

  let totalScore = 0;
  let allMatched = true;

  for (const token of tokens) {
    const labelScore = scoreToken(token, labelWords, labelNorm);
    const catScore   = scoreToken(token, catWords, catNorm) * 0.5;
    const kwScore    = scoreToken(token, kwWords, kwNorm) * 0.4;
    const tokenBest  = Math.max(labelScore, catScore, kwScore);

    if (tokenBest === 0) allMatched = false;
    totalScore += tokenBest;
  }

  if (!allMatched) totalScore = Math.floor(totalScore * 0.3);

  return Math.round(totalScore / tokens.length);
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const nq = norm(query.trim());
  const nt = norm(text);
  const idx = nt.indexOf(nq);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "#fff", fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function useSearchRecents() {
  const load = (): SearchItem[] => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (!raw) return [];
      const paths: string[] = JSON.parse(raw);
      return paths.map((p) => SEARCH_ITEMS.find((item) => item.path === p)).filter(Boolean) as SearchItem[];
    } catch { return []; }
  };

  const save = (item: SearchItem) => {
    try {
      const existing: string[] = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
      const next = [item.path, ...existing.filter((p) => p !== item.path)].slice(0, MAX_RECENTS);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch { /* noop */ }
  };

  return { load, save };
}

function DashboardSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<SearchItem[]>([]);
  const { load: loadRecents, save: saveRecent } = useSearchRecents();

  const results: SearchItem[] = query.trim().length === 0 ? [] : SEARCH_ITEMS
    .map((item) => ({ item, score: scoreItem(item, query.trim()) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ item }) => item);

  const displayItems = query.trim().length === 0 ? recents : results;
  const isShowingRecents = query.trim().length === 0;

  useEffect(() => { setActiveIndex(0); }, [query]);

  const goTo = useCallback((item: SearchItem) => {
    saveRecent(item);
    setRecents(loadRecents());
    setQuery("");
    setFocused(false);
    navigate(item.path);
  }, [navigate, saveRecent, loadRecents]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setRecents(loadRecents());
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadRecents]);

  const onFocus = () => {
    setRecents(loadRecents());
    setFocused(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setQuery(""); setFocused(false); inputRef.current?.blur(); }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, displayItems.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && displayItems[activeIndex]) goTo(displayItems[activeIndex]);
  };

  const showDropdown = focused && displayItems.length > 0;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={focused ? "#666" : "#444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onFocus}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Caută rapid... (⌘K)"
          style={{
            width: "100%", padding: "10px 40px 10px 36px",
            background: "#111", border: `1px solid ${focused ? "#333" : "#1a1a1a"}`,
            borderRadius: "10px", color: "#ccc", fontSize: "14px",
            outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
          }}
        />
        {query ? (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: "4px" }}>
            ×
          </button>
        ) : (
          <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", color: "#333", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "5px", padding: "2px 6px", pointerEvents: "none", letterSpacing: "0.03em" }}>
            ⌘K
          </span>
        )}
      </div>

      {showDropdown && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
          background: "#111", border: "1px solid #222", borderRadius: "12px",
          overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        }}>
          {isShowingRecents && (
            <div style={{ padding: "8px 14px 4px", fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Recente
            </div>
          )}
          {displayItems.map((item, i) => (
            <button
              key={item.path}
              onMouseDown={() => goTo(item)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                width: "100%", padding: "9px 14px",
                background: i === activeIndex ? "#1c1c1c" : "transparent",
                border: "none", borderBottom: i < displayItems.length - 1 ? "1px solid #161616" : "none",
                color: "#aaa", fontSize: "13px", textAlign: "left", cursor: "pointer",
                transition: "background 0.08s",
              }}
            >
              <span style={{ fontSize: "15px", flexShrink: 0, width: 20, textAlign: "center" }}>{item.icon}</span>
              <span style={{ flex: 1, color: i === activeIndex ? "#fff" : "#ccc" }}>
                {isShowingRecents ? item.label : <HighlightMatch text={item.label} query={query} />}
              </span>
              <span style={{ fontSize: "10px", color: "#383838", whiteSpace: "nowrap", background: "#161616", borderRadius: "5px", padding: "2px 7px" }}>
                {item.category}
              </span>
            </button>
          ))}
          <div style={{ padding: "6px 14px", borderTop: "1px solid #161616", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: "#333" }}>↑↓ navighează · Enter deschide · Esc închide</span>
            {!isShowingRecents && results.length > 0 && (
              <span style={{ fontSize: "10px", color: "#383838" }}>{results.length} rezultat{results.length !== 1 ? "e" : ""}</span>
            )}
          </div>
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

        <DeliveryDeadlineOverview events={events} />

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
