import React, { useState, useRef, useEffect } from "react";
import { CITIES } from "../../../pages/LocationSEO/locationData";
import useAuth from "../auth/useAuth";

interface CitySuggestion {
  name: string;
  slug: string;
  county: string;
  estimatedMonthlySearches: number;
  reason: string;
  suggestedServices: string[];
}

const SERVICE_LABELS: Record<string, string> = {
  nunta: "Nuntă",
  botez: "Botez",
  majorat: "Majorat",
  evenimente: "Evenimente",
  "cununie-civila": "Cununie",
  logodna: "Logodnă",
  corporate: "Corporate",
  inmormantare: "Înmormântare",
  "trash-the-dress": "Trash the Dress",
  "save-the-date": "Save the Date",
};

function AnalyzeDialog({
  open,
  streamedText,
  status,
  onClose,
}: {
  open: boolean;
  streamedText: string;
  status: string;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-3 text-xs text-gray-400 font-mono">claude — seo-analyzer</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-mono">live</span>
          </div>
        </div>

        {/* Terminal body */}
        <div
          ref={scrollRef}
          className="bg-gray-950 p-4 h-80 overflow-y-auto font-mono text-sm leading-relaxed"
        >
          {status && (
            <div className="flex items-center gap-2 text-indigo-400 mb-3">
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>{status}</span>
            </div>
          )}

          {streamedText && (
            <div>
              <span className="text-gray-500 select-none">→ </span>
              <span className="text-emerald-300 whitespace-pre-wrap break-words">{streamedText}</span>
              <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-pulse align-middle" />
            </div>
          )}

          {!streamedText && !status && (
            <span className="text-gray-600 italic">Așteptând răspuns de la Claude...</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-t border-gray-700">
          <span className="text-xs text-gray-500 font-mono">
            {streamedText.length > 0 ? `${streamedText.length} caractere primite` : "Se inițializează..."}
          </span>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500"
          >
            Anulează
          </button>
        </div>
      </div>
    </div>
  );
}

const SeoGeneratorPage: React.FC = () => {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<{ generated: string[]; count: number } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const { auth } = useAuth();
  const authHeader = { Authorization: `Bearer ${auth.accessToken}` };
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setDialogOpen(true);
    setStreamedText("");
    setStatusMessage("");
    setAnalyzeError(null);
    setSuggestions([]);
    setSelected(new Set());
    setGenerateResult(null);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/admin/seo/analyze", {
        method: "POST",
        headers: authHeader,
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error("Request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              message?: string;
              suggestions?: CitySuggestion[];
            };

            if (event.type === "status" && event.message) {
              setStatusMessage(event.message);
            } else if (event.type === "text" && event.content) {
              setStreamedText(prev => prev + event.content);
              setStatusMessage("");
            } else if (event.type === "done" && event.suggestions) {
              setSuggestions(event.suggestions);
              setDialogOpen(false);
            } else if (event.type === "error") {
              setAnalyzeError(event.message ?? "Eroare necunoscută");
              setDialogOpen(false);
            }
          } catch {
            // linie SSE invalidă, ignorată
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setAnalyzeError("Analiza a eșuat. Încearcă din nou.");
        setDialogOpen(false);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCancelAnalyze = () => {
    abortRef.current?.abort();
    setDialogOpen(false);
    setAnalyzing(false);
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateResult(null);

    const selectedCities = suggestions.filter(suggestion => selected.has(suggestion.slug));

    try {
      const response = await fetch("/api/admin/seo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ cities: selectedCities }),
      });
      if (!response.ok) throw new Error("Generarea a eșuat");
      const data = await response.json() as { generated: string[]; count: number };
      setGenerateResult(data);
      setSuggestions(prev => prev.filter(suggestion => !selected.has(suggestion.slug)));
      setSelected(new Set());
    } catch {
      setGenerateError("Generarea a eșuat. Încearcă din nou.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (slug: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(
      selected.size === suggestions.length
        ? new Set()
        : new Set(suggestions.map(s => s.slug))
    );
  };

  return (
    <>
      <AnalyzeDialog
        open={dialogOpen}
        streamedText={streamedText}
        status={statusMessage}
        onClose={handleCancelAnalyze}
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Generator SEO Pagini</h1>
          <p className="text-sm text-gray-500 mt-1">
            Folosește Claude AI să identifice orașe cu potențial SEO ridicat și să genereze automat pagini noi.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{CITIES.length}</div>
            <div className="text-xs text-gray-500 mt-1">Orașe acoperite</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">542</div>
            <div className="text-xs text-gray-500 mt-1">URL-uri în sitemap</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-indigo-600">{suggestions.length}</div>
            <div className="text-xs text-gray-500 mt-1">Sugestii găsite</div>
          </div>
        </div>

        {/* Analyze button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analizează...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analizează gaps SEO
              </>
            )}
          </button>
        </div>

        {analyzeError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {analyzeError}
          </div>
        )}

        {/* Results table */}
        {suggestions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.size === suggestions.length}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">
                  {selected.size > 0 ? `${selected.size} selectate` : "Selectează toate"}
                </span>
              </div>
              <button
                onClick={handleGenerate}
                disabled={selected.size === 0 || generating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generează...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Generează {selected.size > 0 ? `(${selected.size})` : ""}
                  </>
                )}
              </button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-10 px-4 py-2" />
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Oraș</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Județ</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Căutări/lună</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Servicii</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Motiv</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(suggestion => (
                  <tr
                    key={suggestion.slug}
                    onClick={() => toggleSelect(suggestion.slug)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${
                      selected.has(suggestion.slug) ? "bg-indigo-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(suggestion.slug)}
                        onChange={() => toggleSelect(suggestion.slug)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{suggestion.name}</td>
                    <td className="px-4 py-3 text-gray-500">{suggestion.county}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${suggestion.estimatedMonthlySearches >= 500 ? "text-emerald-600" : "text-amber-600"}`}>
                        ~{suggestion.estimatedMonthlySearches.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {suggestion.suggestedServices.slice(0, 4).map(serviceSlug => (
                          <span key={serviceSlug} className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {SERVICE_LABELS[serviceSlug] ?? serviceSlug}
                          </span>
                        ))}
                        {suggestion.suggestedServices.length > 4 && (
                          <span className="inline-block px-1.5 py-0.5 text-gray-400 text-xs">
                            +{suggestion.suggestedServices.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{suggestion.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {generating && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
            Claude generează datele pentru {selected.size} {selected.size === 1 ? "oraș" : "orașe"}. Poate dura 30–60 secunde...
          </div>
        )}

        {generateError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {generateError}
          </div>
        )}

        {generateResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="font-medium text-emerald-800 mb-2">
              {generateResult.count} {generateResult.count === 1 ? "oraș adăugat" : "orașe adăugate"} cu succes!
            </div>
            <div className="flex flex-wrap gap-2">
              {generateResult.generated.map(citySlug => (
                <a
                  key={citySlug}
                  href={`/foto-video-nunta-${citySlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs rounded hover:bg-emerald-200 transition-colors"
                >
                  /foto-video-nunta-{citySlug}
                </a>
              ))}
            </div>
            <p className="text-xs text-emerald-700 mt-3">
              Paginile sunt active imediat. Sitemap-ul a fost actualizat automat. Fă un commit pentru a persista modificările.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default SeoGeneratorPage;
