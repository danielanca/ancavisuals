import { CUSTOM_CLAUSE_PREFIX } from "../../../../../shared/contractClauses";
import React, { useEffect, useRef, useState } from "react";
import useAuth from "../../auth/useAuth";
import RichTextEditor from "./RichTextEditor";
import Checkbox from "./Checkbox";
import ClauseAiRewrite from "./ClauseAiRewrite";
import { defaultClauseSetFor, type ClauseSet } from "../../../../../shared/contractClauseSets";

export interface ClauseSnapshot {
  templateId: string;
  key: string;
  title: string;
  body: string;
  order: number;
  groupKey: string | null;
}

interface RenderedClause {
  templateId: string;
  key: string;
  title: string;
  body: string;
  order: number;
  groupKey: string | null;
  mutexGroup: string | null;
  defaultChecked: boolean;
}

interface ClauseServiceInput {
  label: string;
  price: number;
  gratuit?: boolean;
  isTransport?: boolean;
}

interface ClauseChecklistEditorProps {
  eventType: string;
  services: ClauseServiceInput[];
  privateClient: boolean;
  eventDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventLocation?: string;
  clientName?: string;
  priceTotal?: number;
  currency?: string;
  priceAdvance?: number;
  priceRest?: number;
  bankBeneficiaryName?: string;
  bankIban?: string;
  transportKm?: string | number;
  transportFuelPrice?: string | number;
  value: ClauseSnapshot[];
  onChange: (clauses: ClauseSnapshot[]) => void;
}

const ClauseChecklistEditor: React.FC<ClauseChecklistEditorProps> = ({
  eventType, services, privateClient, eventDate, eventStartTime, eventEndTime, eventLocation,
  clientName, priceTotal, currency, priceAdvance, priceRest, bankBeneficiaryName, bankIban,
  transportKm, transportFuelPrice, value, onChange,
}) => {
  const { auth } = useAuth();
  const [rendered, setRendered] = useState<RenderedClause[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, { title: string; body: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededFromValue = useRef(false);
  const [sets, setSets] = useState<Pick<ClauseSet, "id" | "name" | "eventType">[]>([]);
  // "" = shared library; otherwise a saved template id.
  const [setId, setSetId] = useState("");
  const setChosenByHand = useRef(false);

  const getToken = async (force = false) => (auth.user ? auth.user.getIdToken(force) : auth.accessToken);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/admin/contract-clause-templates/sets", { headers: { Authorization: `Bearer ${token}` } });
        if (!res?.ok || cancelled) return;
        const data = (await res.json()) as { sets?: ClauseSet[] };
        if (!cancelled) setSets((data.sets ?? []).map(({ id, name, eventType: type }) => ({ id, name, eventType: type })));
      } catch {
        // No templates available: the shared library still works.
      }
    })();
    return () => { cancelled = true; };
    // Templates are loaded once per form; the token getter is stable enough for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the event type until the admin picks a template by hand.
  useEffect(() => {
    if (setChosenByHand.current) return;
    setSetId(defaultClauseSetFor(sets, eventType)?.id ?? "");
  }, [sets, eventType]);

  // EditContractPage loads an existing contract's saved clause snapshot asynchronously — once it
  // arrives, show it directly instead of forcing the admin to click "Generează" (which would
  // discard their previously-edited text and pull fresh defaults from the library instead).
  useEffect(() => {
    if (seededFromValue.current || value.length === 0) return;
    seededFromValue.current = true;
    const seeded: RenderedClause[] = value.map((v) => ({
      templateId: v.templateId, key: v.key, title: v.title, body: v.body,
      order: v.order, groupKey: v.groupKey, mutexGroup: null, defaultChecked: true,
    }));
    setRendered(seeded);
    const nextChecked: Record<string, boolean> = {};
    seeded.forEach((c) => { nextChecked[c.templateId] = true; });
    setChecked(nextChecked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function generate() {
    if (rendered && !window.confirm("Regenerezi clauzele din bibliotecă? Modificările lor manuale se pierd. Clauzele adăugate separat se păstrează.")) return;
    setLoading(true);
    setError(null);
    try {
      const body = JSON.stringify({
          ...(setId ? { setId } : {}),
          eventType, services, privateClient, eventDate, eventStartTime, eventEndTime, eventLocation,
          clientName, priceTotal, currency, priceAdvance, priceRest, bankBeneficiaryName, bankIban,
          transportKm: transportKm ? Number(transportKm) : undefined, transportFuelPrice,
      });
      const request = (token: string) => fetch("/api/admin/contract-clause-templates/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
      });
      const initialToken = auth.user ? await auth.user.getIdToken(false) : auth.accessToken;
      if (!initialToken) throw new Error("Sesiunea a expirat. Reîncarcă pagina și autentifică-te din nou.");

      let res = await request(initialToken);
      if (res.status === 401 && auth.user) {
        const refreshedToken = await auth.user.getIdToken(true);
        res = await request(refreshedToken);
      }

      const data = await res.json() as { clauses?: RenderedClause[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Eroare la generarea clauzelor.");
      const clauses = data.clauses ?? [];
      const custom = (rendered ?? []).filter((clause) => clause.key.startsWith(CUSTOM_CLAUSE_PREFIX));
      let order = Math.max(0, ...clauses.map((clause) => clause.order));
      clauses.push(...custom.map((clause) => ({ ...clause, order: ++order })));
      setRendered(clauses);
      const nextChecked: Record<string, boolean> = {};
      clauses.forEach((c) => { nextChecked[c.templateId] = c.key.startsWith(CUSTOM_CLAUSE_PREFIX) ? checked[c.templateId] ?? true : c.defaultChecked; });
      setChecked(nextChecked);
      setEdited((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => custom.some((clause) => clause.templateId === id))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare.");
    } finally {
      setLoading(false);
    }
  }

  function addClause() {
    // Mark local initialization so the outgoing custom clause is not re-seeded as a saved snapshot.
    seededFromValue.current = true;
    const id = `${CUSTOM_CLAUSE_PREFIX}${crypto.randomUUID()}`;
    const clause: RenderedClause = { templateId: id, key: id, title: "", body: "", order: Math.max(0, ...(rendered ?? []).map((item) => item.order)) + 1, groupKey: null, mutexGroup: null, defaultChecked: true };
    setRendered((prev) => [...(prev ?? []), clause]);
    setChecked((prev) => ({ ...prev, [id]: true }));
  }

  function removeClause(id: string) {
    setRendered((prev) => prev?.filter((clause) => clause.templateId !== id) ?? null);
    setEdited((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  function toggle(clause: RenderedClause, next: boolean) {
    setChecked((prev) => {
      const updated = { ...prev, [clause.templateId]: next };
      if (next && clause.mutexGroup && rendered) {
        rendered
          .filter((c) => c.mutexGroup === clause.mutexGroup && c.templateId !== clause.templateId)
          .forEach((c) => { updated[c.templateId] = false; });
      }
      return updated;
    });
  }

  function editField(templateId: string, base: RenderedClause, field: "title" | "body", newValue: string) {
    setEdited((prev) => ({
      ...prev,
      [templateId]: {
        title: field === "title" ? newValue : (prev[templateId]?.title ?? base.title),
        body: field === "body" ? newValue : (prev[templateId]?.body ?? base.body),
      },
    }));
  }

  useEffect(() => {
    if (!rendered) return;
    const outgoing: ClauseSnapshot[] = rendered
      .filter((c) => checked[c.templateId])
      .map((c) => ({
        templateId: c.templateId,
        key: c.key,
        title: edited[c.templateId]?.title ?? c.title,
        body: edited[c.templateId]?.body ?? c.body,
        order: c.order,
        groupKey: c.groupKey,
      }))
      .sort((a, b) => a.order - b.order);
    onChange(outgoing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, checked, edited]);

  return (
    <div className="space-y-3">
      {sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="clause-set" className="text-xs text-neutral-400">Șablon clauze</label>
          <select
            id="clause-set"
            value={setId}
            onChange={(e) => { setChosenByHand.current = true; setSetId(e.target.value); }}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neutral-500"
          >
            <option value="">Biblioteca standard (comune + tipul evenimentului)</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>{set.name}{set.eventType === eventType ? " — recomandat" : ""}</option>
            ))}
          </select>
          {rendered && <span className="text-xs text-neutral-600">Apasă „Regenerează clauzele” după ce schimbi șablonul.</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !eventType}
          className="px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Se generează..." : rendered ? "Regenerează clauzele" : "Generează clauzele"}
        </button>
        <button type="button" onClick={addClause} disabled={loading} className="px-4 py-2 text-sm bg-violet-500/20 text-violet-300 rounded-lg disabled:opacity-50">Adaugă clauză</button>
        {!eventType && <span className="text-xs text-neutral-600">Selectează tipul evenimentului mai întâi.</span>}
        {rendered && <span className="text-xs text-neutral-500">{value.length} din {rendered.length} clauze bifate</span>}
      </div>

      <p className="text-xs text-neutral-500">Completează titlul și textul. AI propune o variantă pe care o poți verifica și aplica.</p>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {rendered && (
        <div className="space-y-2">
          {rendered.map((clause) => {
            const isChecked = checked[clause.templateId] ?? false;
            const currentTitle = edited[clause.templateId]?.title ?? clause.title;
            const currentBody = edited[clause.templateId]?.body ?? clause.body;
            return (
              <div key={clause.templateId} className={`rounded-lg border p-3 ${isChecked ? "border-neutral-700 bg-neutral-900" : "border-neutral-800/50 bg-neutral-900/40 opacity-60"}`}>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={isChecked}
                    onChange={(checked) => toggle(clause, checked)}
                    className="mt-1"
                  />
                  <input
                    aria-label="Titlu clauză"
                    placeholder="Titlul clauzei"
                    maxLength={300}
                    value={currentTitle}
                    onChange={(e) => editField(clause.templateId, clause, "title", e.target.value)}
                    className="bg-transparent text-sm text-white font-medium flex-1 outline-none border-b border-transparent focus:border-neutral-600"
                  />
                </label>
                {clause.key.startsWith(CUSTOM_CLAUSE_PREFIX) && <button type="button" onClick={() => removeClause(clause.templateId)} className="mt-2 text-xs text-red-400">Șterge clauza</button>}
                {isChecked && (
                  <div className="mt-2">
                    <RichTextEditor
                      value={currentBody}
                      onChange={(html) => editField(clause.templateId, clause, "body", html)}
                      label="Text clauză"
                      minHeight={70}
                    />
                    <ClauseAiRewrite title={currentTitle} body={currentBody} onApply={(proposal) => setEdited((prev) => ({ ...prev, [clause.templateId]: proposal }))} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClauseChecklistEditor;
