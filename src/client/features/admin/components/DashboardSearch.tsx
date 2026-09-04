import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

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
  { label: "Blog", path: "/admin/blog", category: "Marketing & Web", icon: "✍️", keywords: "articole markdown continut publicare draft" },
  { label: "Campanii", path: "/admin/campanii", category: "Marketing & Web", icon: "📣", keywords: "campanie marketing email newsletter" },
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

export default function DashboardSearch({ onNavigate }: { onNavigate?: () => void } = {}) {
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
    onNavigate?.();
  }, [navigate, saveRecent, loadRecents, onNavigate]);

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
