/*
 * Purpose: editor for the named clause templates (Nuntă, Botez, Majorat, Corporate…). Each
 * template is a complete list of clauses saved on its own; the contract form picks one.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import RichTextEditor from "./RichTextEditor";
import { EVENT_TYPES } from "./CreateContractPage";
import { CONDITION_TAGS } from "./clauseConditionTags";
import {
  CLAUSE_SET_NAME_MAX,
  DEFAULT_CLAUSE_SET_EVENT_TYPES,
  normalizeClauseSetInput,
  type ClauseSet,
  type ClauseSetClause,
} from "../../../../../shared/contractClauseSets";

const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500";
const API = "/api/admin/contract-clause-templates/sets";

type Draft = { name: string; eventType: string; clauses: ClauseSetClause[] };

const toDraft = (set: ClauseSet): Draft => ({ name: set.name, eventType: set.eventType ?? "", clauses: set.clauses.map((c) => ({ ...c })) });

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Eroare ${res.status}`);
  return data;
}

export default function ClauseSetsPanel({ authHeader }: { authHeader: Record<string, string> }) {
  const [sets, setSets] = useState<ClauseSet[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEventType, setNewEventType] = useState("");

  const load = useCallback(async (selectId?: string) => {
    try {
      const data = await readJson<{ sets: ClauseSet[] }>(await fetch(API, { headers: authHeader }));
      setSets(data.sets);
      const next = data.sets.find((s) => s.id === selectId) ?? data.sets[0] ?? null;
      setSelectedId(next?.id ?? null);
      setDraft(next ? toDraft(next) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare.");
    }
  }, [authHeader]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => sets?.find((s) => s.id === selectedId) ?? null, [sets, selectedId]);
  const dirty = !!selected && !!draft && JSON.stringify(toDraft(selected)) !== JSON.stringify(draft);
  const missingDefaults = DEFAULT_CLAUSE_SET_EVENT_TYPES.filter((type) => !sets?.some((s) => s.eventType === type));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Eroare."); } finally { setBusy(false); }
  };

  const select = (set: ClauseSet) => {
    if (dirty && !window.confirm("Ai modificări nesalvate în șablonul curent. Le renunți?")) return;
    setSelectedId(set.id);
    setDraft(toDraft(set));
    setNotice(null);
  };

  const createDefaults = () => run(async () => {
    const data = await readJson<{ created: string[] }>(await fetch(`${API}/defaults`, { method: "POST", headers: authHeader }));
    setNotice(data.created.length ? `Create: ${data.created.join(", ")}.` : "Toate șabloanele principale există deja.");
    await load(selectedId ?? undefined);
  });

  const createFromLibrary = () => run(async () => {
    const data = await readJson<{ set: ClauseSet }>(await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ name: newName.trim() || newEventType || "Șablon nou", eventType: newEventType || null, fromLibrary: true }),
    }));
    setNewName("");
    await load(data.set.id);
  });

  const duplicate = () => selected && run(async () => {
    const data = await readJson<{ set: ClauseSet }>(await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ fromSetId: selected.id, name: `${selected.name} (copie)`.slice(0, CLAUSE_SET_NAME_MAX) }),
    }));
    await load(data.set.id);
  });

  const save = () => selected && draft && run(async () => {
    const checked = normalizeClauseSetInput({ ...draft, eventType: draft.eventType || null });
    if ("error" in checked) throw new Error(checked.error);
    if (draft.eventType && sets?.some((s) => s.id !== selected.id && s.eventType === draft.eventType)) {
      throw new Error(`Există deja un șablon implicit pentru ${draft.eventType}. Alege alt tip sau „Niciunul”.`);
    }
    await readJson(await fetch(`${API}/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ ...draft, eventType: draft.eventType || null }),
    }));
    setNotice("Șablon salvat.");
    await load(selected.id);
  });

  const remove = () => selected && window.confirm(`Ștergi definitiv șablonul „${selected.name}”? Contractele deja create nu sunt afectate.`) && run(async () => {
    await readJson(await fetch(`${API}/${selected.id}`, { method: "DELETE", headers: authHeader }));
    await load();
  });

  const updateClause = (index: number, patch: Partial<ClauseSetClause>) =>
    setDraft((d) => d && { ...d, clauses: d.clauses.map((c, i) => (i === index ? { ...c, ...patch } : c)) });

  const moveClause = (index: number, direction: -1 | 1) => setDraft((d) => {
    if (!d) return d;
    const target = index + direction;
    if (target < 0 || target >= d.clauses.length) return d;
    const clauses = [...d.clauses];
    [clauses[index], clauses[target]] = [clauses[target], clauses[index]];
    return { ...d, clauses };
  });

  const addClause = () => setDraft((d) => d && {
    ...d,
    clauses: [...d.clauses, {
      key: `clauza-${Date.now()}`, title: "Clauză nouă", bodyTemplate: "<p>Text clauză...</p>",
      order: (d.clauses.length + 1) * 10, groupKey: null, conditionTag: null, mutexGroup: null, isActive: true,
    }],
  });

  const removeClause = (index: number) => setDraft((d) => d && { ...d, clauses: d.clauses.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        <p className="text-sm text-neutral-300">
          Fiecare șablon e o listă completă de clauze, salvată separat. Când faci un contract alegi șablonul, iar cel cu tipul evenimentului e preselectat.
        </p>
        {missingDefaults.length > 0 && (
          <button type="button" onClick={() => void createDefaults()} disabled={busy}
            className="px-3 py-1.5 text-xs text-emerald-400 border border-emerald-500/30 rounded-lg hover:border-emerald-400 disabled:opacity-50">
            Creează șabloanele: {missingDefaults.join(", ")} (din biblioteca actuală)
          </button>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs text-neutral-500 mb-1">Șablon nou — nume</label>
            <input className={inp} value={newName} maxLength={CLAUSE_SET_NAME_MAX} onChange={(e) => setNewName(e.target.value)} placeholder="ex. Nuntă fără video" />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs text-neutral-500 mb-1">Pornește de la clauzele pentru</label>
            <select className={inp} value={newEventType} onChange={(e) => setNewEventType(e.target.value)}>
              <option value="">Doar clauzele comune</option>
              {EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void createFromLibrary()} disabled={busy}
            className="px-3 py-2 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50">
            + Creează șablon
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
      {!sets && !error && <p className="text-sm text-neutral-500">Se încarcă...</p>}
      {sets && sets.length === 0 && <p className="text-sm text-neutral-500">Niciun șablon încă. Creează-le pe cele principale cu butonul de mai sus.</p>}

      {sets && sets.length > 0 && (
        <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Șabloane">
          {sets.map((set) => (
            <button key={set.id} type="button" role="tab" aria-selected={set.id === selectedId} onClick={() => select(set)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${set.id === selectedId ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}>
              {set.name}{set.eventType ? " ★" : ""}
            </button>
          ))}
        </div>
      )}

      {selected && draft && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Nume șablon</label>
              <input className={inp} value={draft.name} maxLength={CLAUSE_SET_NAME_MAX} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Preselectat la contractele de tip (★)</label>
              <select className={inp} value={draft.eventType} onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}>
                <option value="">Niciunul (îl aleg manual)</option>
                {EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={!dirty || busy}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40">
              {busy ? "Se salvează..." : dirty ? "Salvează șablonul" : "Salvat"}
            </button>
            <button type="button" onClick={addClause} className="px-3 py-2 text-xs rounded-lg bg-violet-500/20 text-violet-300">+ Adaugă clauză</button>
            <button type="button" onClick={() => void duplicate()} disabled={busy} className="px-3 py-2 text-xs rounded-lg border border-neutral-700 text-neutral-300 hover:border-neutral-500">Duplică</button>
            <button type="button" onClick={() => void remove()} disabled={busy} className="ml-auto px-3 py-2 text-xs rounded-lg border border-red-900 text-red-400 hover:border-red-700">Șterge șablonul</button>
          </div>

          <p className="text-xs text-neutral-500">{draft.clauses.filter((c) => c.isActive).length} din {draft.clauses.length} clauze active</p>

          <div className="space-y-2">
            {draft.clauses.map((clause, index) => (
              <SetClauseRow
                key={clause.key}
                clause={clause}
                index={index}
                count={draft.clauses.length}
                onChange={(patch) => updateClause(index, patch)}
                onMove={(direction) => moveClause(index, direction)}
                onRemove={() => removeClause(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SetClauseRow({ clause, index, count, onChange, onMove, onRemove }: {
  clause: ClauseSetClause;
  index: number;
  count: number;
  onChange: (patch: Partial<ClauseSetClause>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border ${clause.isActive ? "border-neutral-800" : "border-neutral-800/50 opacity-60"} bg-neutral-900`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <input type="checkbox" aria-label={`Activă: ${clause.title}`} checked={clause.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} className="accent-emerald-500" />
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex-1 min-w-0 text-left text-sm text-white truncate">
          {index + 1}. {clause.title}
          {clause.conditionTag && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500">{clause.conditionTag}</span>}
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Mută sus" className="text-xs px-1.5 text-neutral-500 hover:text-white disabled:opacity-30">▲</button>
        <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Mută jos" className="text-xs px-1.5 text-neutral-500 hover:text-white disabled:opacity-30">▼</button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-neutral-800 pt-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Titlu</label>
            <input className={inp} value={clause.title} maxLength={300} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <RichTextEditor value={clause.bodyTemplate} onChange={(html) => onChange({ bodyTemplate: html })} label="Text clauză" />
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Condiție de bifare implicită</label>
            <select className={inp} value={clause.conditionTag ?? ""} onChange={(e) => onChange({ conditionTag: e.target.value || null })}>
              {CONDITION_TAGS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">Scoate clauza din șablon</button>
        </div>
      )}
    </div>
  );
}
