import React, { useEffect, useRef, useState } from "react";
import useAuth from "../../auth/useAuth";
import RichTextEditor from "./RichTextEditor";

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
    if (rendered && !window.confirm("Regenerezi clauzele? Modificările făcute manual pe lista curentă se pierd.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contract-clause-templates/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({
          eventType, services, privateClient, eventDate, eventStartTime, eventEndTime, eventLocation,
          clientName, priceTotal, currency, priceAdvance, priceRest, bankBeneficiaryName, bankIban,
          transportKm: transportKm ? Number(transportKm) : undefined, transportFuelPrice,
        }),
      });
      const data = await res.json() as { clauses?: RenderedClause[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Eroare la generarea clauzelor.");
      const clauses = data.clauses ?? [];
      setRendered(clauses);
      const nextChecked: Record<string, boolean> = {};
      clauses.forEach((c) => { nextChecked[c.templateId] = c.defaultChecked; });
      setChecked(nextChecked);
      setEdited({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare.");
    } finally {
      setLoading(false);
    }
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !eventType}
          className="px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
        >
          {loading ? "Se generează..." : rendered ? "Regenerează clauzele" : "Generează clauzele"}
        </button>
        {!eventType && <span className="text-xs text-neutral-600">Selectează tipul evenimentului mai întâi.</span>}
        {rendered && <span className="text-xs text-neutral-500">{value.length} din {rendered.length} clauze bifate</span>}
      </div>

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
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => toggle(clause, e.target.checked)}
                    className="mt-1 w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                  />
                  <input
                    value={currentTitle}
                    onChange={(e) => editField(clause.templateId, clause, "title", e.target.value)}
                    className="bg-transparent text-sm text-white font-medium flex-1 outline-none border-b border-transparent focus:border-neutral-600"
                  />
                </label>
                {isChecked && (
                  <div className="mt-2">
                    <RichTextEditor
                      value={currentBody}
                      onChange={(html) => editField(clause.templateId, clause, "body", html)}
                      minHeight={70}
                    />
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
