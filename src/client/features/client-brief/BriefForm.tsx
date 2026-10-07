import React from "react";
import { emptyMomentAnswer, type BriefAnswers, type BriefMoment, type MomentAnswer } from "../../../shared/clientBrief/clientBrief";

const fieldClass = "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-white outline-none focus:border-amber-200 disabled:opacity-80";
const textFields: { key: Exclude<keyof BriefAnswers, "moments">; label: string; placeholder: string }[] = [
  { key: "priorities", label: "Ce contează cel mai mult pentru voi?", placeholder: "Momentele și amintirile pe care vreți neapărat să le păstrați…" },
  { key: "groupPhotos", label: "Poze de grup cu invitații", placeholder: "Cu toți invitații, cu fiecare familie sau cu anumite grupuri? Scrieți cu cine și când…" },
  { key: "importantPeople", label: "Persoane pe care să le surprindem mai des", placeholder: "Nume și cine sunt pentru voi: părinți, bunici, nași, prieteni…" },
  { key: "schedule", label: "Ore și locații", placeholder: "Programul, adresele sau linkurile Google Maps…" },
  { key: "contact", label: "Persoana de contact în ziua evenimentului", placeholder: "Nume și telefon…" },
  { key: "avoid", label: "Ce să evităm / situații delicate", placeholder: "Ce ar fi bine să știm…" },
  { key: "notes", label: "Surprize și alte dorințe", placeholder: "Orice altceva este important pentru voi…" },
];
export default function BriefForm({ answers, moments, onChange, readOnly = false, disabled = false }: {
  answers: BriefAnswers; moments: BriefMoment[]; onChange?: (answers: BriefAnswers) => void; readOnly?: boolean; disabled?: boolean;
}) {
  function updateMoment(id: string, patch: Partial<MomentAnswer>) {
    const value = { ...emptyMomentAnswer(), ...answers.moments[id], ...patch };
    if (value.presence === "no") value.coverage = "";
    const updated = { ...answers.moments };
    for (const moment of moments) {
      if (!updated[moment.id]) updated[moment.id] = { ...emptyMomentAnswer(), presence: "no" };
    }
    onChange?.({ ...answers, moments: { ...updated, [id]: value } });
  }
  function textField(field: typeof textFields[number]) {
    return <label key={field.key} className="block space-y-2">
      <span className="block font-medium">{field.label}</span>
      <textarea className={fieldClass} rows={field.key === "priorities" || field.key === "schedule" ? 3 : 2} maxLength={5000}
        placeholder={field.placeholder} value={answers[field.key]} onChange={event => onChange?.({ ...answers, [field.key]: event.target.value })} />
      {field.key === "importantPeople" && <span className="block text-sm text-neutral-400">În dimineața nunții vă vom reaminti să ne arătați persoanele importante pentru voi. Va trebui să ni le indicați personal, ca să le recunoaștem.</span>}
    </label>;
  }
  return <fieldset disabled={readOnly || disabled} className="space-y-6 min-w-0">
    {textField(textFields[0])}
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Momentele din program</h2>
      <p className="text-sm text-neutral-400">Bifați ce aveți în program și adăugați detalii unde este cazul.</p>
      {moments.map(moment => {
        const answer = answers.moments[moment.id] ?? emptyMomentAnswer();
        const selected = answer.presence === "yes";
        return <section key={moment.id} aria-label={moment.label} className="rounded-lg border border-neutral-800 p-3 sm:p-4 space-y-3">
          <label className="flex items-center gap-3 py-1 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-amber-200" checked={selected}
              onChange={event => updateMoment(moment.id, { presence: event.target.checked ? "yes" : "no" })} />
            <span>{moment.label}</span>
          </label>
          {(selected || (readOnly && answer.details)) && <>
            {moment.integral && selected && <label className="flex items-center gap-3 py-2 text-sm text-neutral-300 cursor-pointer">
              <input type="checkbox" className="h-4 w-4 shrink-0 accent-amber-200" checked={answer.coverage === "full"}
                onChange={event => updateMoment(moment.id, { coverage: event.target.checked ? "full" : "highlights" })} />
              <span>{moment.id === "religious" ? "Vrem filmarea întregii ceremonii religioase, cu sunet" : "Vrem filmarea integrală, cu sunet"}</span>
            </label>}
            <label className="block"><span className="sr-only">Detalii pentru {moment.label}</span>
              <textarea className={fieldClass} rows={2} maxLength={3000} placeholder="Ora, locația, persoane sau detalii importante…" value={answer.details}
                onChange={event => updateMoment(moment.id, { details: event.target.value })} />
            </label>
          </>}
        </section>;
      })}
    </section>
    {textFields.slice(1).map(textField)}
  </fieldset>;
}
