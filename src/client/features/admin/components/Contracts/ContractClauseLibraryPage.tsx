import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../Breadcrumb";
import useAuth from "../../auth/useAuth";
import { EVENT_TYPES } from "./CreateContractPage";
import RichTextEditor from "./RichTextEditor";

interface ClauseTemplate {
  id: string;
  key: string;
  title: string;
  bodyTemplate: string;
  appliesTo: string;
  order: number;
  groupKey: string | null;
  conditionTag: string | null;
  mutexGroup: string | null;
  isActive: boolean;
}

const CONDITION_TAGS: { value: string; label: string }[] = [
  { value: "", label: "Fără condiție (mereu bifat implicit)" },
  { value: "hasFoto", label: "Doar dacă are serviciu Foto" },
  { value: "hasVideo", label: "Doar dacă are serviciu Video" },
  { value: "hasPhotobooth", label: "Doar dacă are Fotocabină / Photo Booth" },
  { value: "hasVideobooth", label: "Doar dacă are VideoBooth 360°" },
  { value: "hasPhotoVideo", label: "Doar dacă are Foto sau Video" },
  { value: "privateClient", label: "Doar dacă e client privat (confidențialitate)" },
  { value: "notPrivateClient", label: "Doar dacă NU e client privat" },
  { value: "hasPhotoVideoAndPrivate", label: "Foto/Video + client privat" },
  { value: "hasPhotoVideoAndNotPrivate", label: "Foto/Video + NU e client privat" },
];

// Trebuie ținut sincronizat manual cu CLAUSE_TOKENS din src/server/services/contractClauseInterpolation.ts
// (fișierul de server nu poate fi importat în bundle-ul de client — folosește puppeteer).
const CLAUSE_TOKENS_LEGEND: { token: string; description: string }[] = [
  { token: "{{eventDateFormatted}}", description: "Data evenimentului (ex: 12 iulie 2026)" },
  { token: "{{eventStartTime}}", description: "Ora de început a evenimentului" },
  { token: "{{eventEndTime}}", description: "Ora de final a evenimentului" },
  { token: "{{eventLocation}}", description: "Locația evenimentului" },
  { token: "{{eventType}}", description: "Tipul evenimentului (ex: Nuntă)" },
  { token: "{{clientName}}", description: "Numele beneficiarului" },
  { token: "{{contractTitle}}", description: "Titlul contractului (ex: Foto-Video)" },
  { token: "{{priceTotal}}", description: "Prețul total (fără monedă)" },
  { token: "{{currency}}", description: "Moneda (RON/EUR)" },
  { token: "{{priceAdvance}}", description: "Avansul" },
  { token: "{{priceRest}}", description: "Restul de plată" },
  { token: "{{transportEstimatedCost}}", description: "Estimarea costului de transport (dacă e cazul)" },
  { token: "{{bankBeneficiaryName}}", description: "Numele beneficiarului contului bancar" },
  { token: "{{bankIban}}", description: "IBAN-ul pentru plată" },
];

const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500";

function ClauseRow({
  template, siblings, index, onSave, onDelete, onMove, saving,
}: {
  template: ClauseTemplate;
  siblings: ClauseTemplate[];
  index: number;
  onSave: (id: string, updates: Partial<ClauseTemplate>) => void;
  onDelete: (id: string) => void;
  onMove: (list: ClauseTemplate[], index: number, direction: -1 | 1) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(template.title);
  const [bodyTemplate, setBodyTemplate] = useState(template.bodyTemplate);
  const [conditionTag, setConditionTag] = useState(template.conditionTag ?? "");
  const [groupKey, setGroupKey] = useState(template.groupKey ?? "");
  const [mutexGroup, setMutexGroup] = useState(template.mutexGroup ?? "");
  const [isActive, setIsActive] = useState(template.isActive !== false);

  const dirty = title !== template.title || bodyTemplate !== template.bodyTemplate
    || conditionTag !== (template.conditionTag ?? "") || groupKey !== (template.groupKey ?? "")
    || mutexGroup !== (template.mutexGroup ?? "") || isActive !== (template.isActive !== false);

  return (
    <div className={`rounded-lg border ${isActive ? "border-neutral-800" : "border-neutral-800/50 opacity-60"} bg-neutral-900`}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-neutral-800/40 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white text-sm font-medium truncate">{template.title}</span>
          {template.conditionTag && <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500 shrink-0">{template.conditionTag}</span>}
          {template.groupKey && <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-800 text-sky-500 shrink-0">grup: {template.groupKey}</span>}
          {template.mutexGroup && <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-800 text-amber-500 shrink-0">exclusiv: {template.mutexGroup}</span>}
          {!isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500 shrink-0">inactivă</span>}
        </div>
        <span className="text-neutral-600 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-neutral-800 pt-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onMove(siblings, index, -1)} disabled={index === 0} className="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:border-neutral-500 disabled:opacity-30">▲ sus</button>
            <button type="button" onClick={() => onMove(siblings, index, 1)} disabled={index === siblings.length - 1} className="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:border-neutral-500 disabled:opacity-30">▼ jos</button>
            <label className="flex items-center gap-1.5 text-xs text-neutral-400 ml-auto cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-emerald-500" />
              activă
            </label>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Titlu</label>
            <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Text clauză</label>
            <RichTextEditor value={bodyTemplate} onChange={setBodyTemplate} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Condiție de bifare implicită</label>
              <select className={inp} value={conditionTag} onChange={(e) => setConditionTag(e.target.value)}>
                {CONDITION_TAGS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Grup (se concatenează sub același titlu)</label>
              <input className={inp} value={groupKey} onChange={(e) => setGroupKey(e.target.value)} placeholder="opțional" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Grup exclusiv (mutex — alege doar una din grup, ex. la Drepturi imagine)</label>
            <input className={inp} value={mutexGroup} onChange={(e) => setMutexGroup(e.target.value)} placeholder="opțional" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => onSave(template.id, {
                title, bodyTemplate,
                conditionTag: conditionTag || null,
                groupKey: groupKey || null,
                mutexGroup: mutexGroup || null,
                isActive,
              })}
              className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
            >
              {saving ? "Se salvează..." : "Salvează"}
            </button>
            <button type="button" onClick={() => onDelete(template.id)} className="px-3 py-1.5 text-xs rounded-lg border border-red-900 text-red-400 hover:border-red-700 transition-colors ml-auto">
              Șterge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ContractClauseLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${auth.accessToken}` }), [auth.accessToken]);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/contract-clause-templates?includeInactive=true", { headers: authHeader })
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare."))
      .finally(() => setLoading(false));
  }, [authHeader]);

  useEffect(() => { if (auth.accessToken) load(); }, [auth.accessToken, load]);

  const sharedTemplates = useMemo(
    () => templates.filter((t) => t.appliesTo === "all").sort((a, b) => a.order - b.order),
    [templates]
  );
  const specificTemplates = useMemo(
    () => activeTab !== "all" ? templates.filter((t) => t.appliesTo === activeTab).sort((a, b) => a.order - b.order) : [],
    [templates, activeTab]
  );

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/contract-clause-templates/seed-defaults", { method: "POST", headers: authHeader });
      const data = await res.json();
      if (data.skipped) alert(data.message ?? "Biblioteca are deja clauze.");
      load();
    } finally {
      setSeeding(false);
    }
  }

  async function handleSave(id: string, updates: Partial<ClauseTemplate>) {
    setSavingId(id);
    try {
      await fetch(`/api/admin/contract-clause-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(updates),
      });
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Ștergi definitiv această clauză din bibliotecă? Contractele deja create nu sunt afectate.")) return;
    await fetch(`/api/admin/contract-clause-templates/${id}`, { method: "DELETE", headers: authHeader });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleAdd(appliesTo: string) {
    const maxOrder = Math.max(0, ...templates.filter((t) => t.appliesTo === appliesTo).map((t) => t.order));
    await fetch("/api/admin/contract-clause-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        key: `clauza-${Date.now()}`,
        title: "Clauză nouă",
        bodyTemplate: "<p>Text clauză...</p>",
        appliesTo,
        order: maxOrder + 10,
        groupKey: null,
        conditionTag: null,
        mutexGroup: null,
      }),
    });
    load();
  }

  async function handleMove(list: ClauseTemplate[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    await fetch("/api/admin/contract-clause-templates/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ updates: [{ id: a.id, order: b.order }, { id: b.id, order: a.order }] }),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Șabloane contract</h1>
            <p className="text-neutral-400 text-sm mt-1">Clauzele disponibile la crearea unui contract nou, bifate implicit.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/admin/contracts")} className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors">
              ← Contracte
            </button>
            <button onClick={() => setShowLegend((v) => !v)} className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-600 transition-colors">
              {showLegend ? "Ascunde token-uri" : "Token-uri disponibile"}
            </button>
          </div>
        </div>

        {showLegend && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-xs text-neutral-400 space-y-1">
            <p className="text-neutral-300 mb-2">Poți folosi aceste token-uri în text — se înlocuiesc automat cu valorile reale când apeși „Generează clauzele" în formularul de contract nou. După generare, textul e final și editabil liber.</p>
            {CLAUSE_TOKENS_LEGEND.map((t) => (
              <div key={t.token} className="flex gap-2">
                <code className="text-emerald-400">{t.token}</code>
                <span>— {t.description}</span>
              </div>
            ))}
          </div>
        )}

        {templates.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 py-16 text-center">
            <p className="text-sm text-neutral-500 mb-4">Biblioteca e goală.</p>
            <button onClick={handleSeed} disabled={seeding} className="px-5 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
              {seeding ? "Se populează..." : "Populează cu clauzele standard"}
            </button>
          </div>
        )}

        {loading && <p className="text-center py-10 text-sm text-neutral-500">Se încarcă...</p>}
        {error && <p className="text-center py-10 text-sm text-red-400">Eroare: {error}</p>}

        {!loading && templates.length > 0 && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${activeTab === "all" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
              >
                Toate tipurile
              </button>
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${activeTab === type ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {activeTab === "all" ? "Clauze comune (toate tipurile)" : `Comune (se aplică și pentru ${activeTab})`}
                </h2>
                {activeTab === "all" && (
                  <button onClick={() => handleAdd("all")} className="text-xs text-emerald-400 hover:text-emerald-300">+ Adaugă clauză</button>
                )}
              </div>
              {sharedTemplates.map((t, i) => (
                <ClauseRow key={t.id} template={t} siblings={sharedTemplates} index={i} onSave={handleSave} onDelete={handleDelete} onMove={handleMove} saving={savingId === t.id} />
              ))}
            </div>

            {activeTab !== "all" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Specifice pentru {activeTab}</h2>
                  <button onClick={() => handleAdd(activeTab)} className="text-xs text-emerald-400 hover:text-emerald-300">+ Adaugă clauză pentru {activeTab}</button>
                </div>
                {specificTemplates.length === 0 ? (
                  <p className="text-xs text-neutral-600 py-4 text-center border border-dashed border-neutral-800 rounded-lg">Nicio clauză specifică pentru {activeTab} — se folosesc doar cele comune de mai sus.</p>
                ) : (
                  specificTemplates.map((t, i) => (
                    <ClauseRow key={t.id} template={t} siblings={specificTemplates} index={i} onSave={handleSave} onDelete={handleDelete} onMove={handleMove} saving={savingId === t.id} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContractClauseLibraryPage;
