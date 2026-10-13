import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FEEDBACK_MESSAGE_LIMIT, FEEDBACK_NAME_LIMIT, FEEDBACK_VARIANT_COUNT, isFeedbackSlug } from "../../../shared/feedback/feedback";

export default function FeedbackPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState<"ai" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const active = useRef<AbortController | null>(null);
  const variantsRef = useRef<HTMLFieldSetElement | null>(null);
  const requestId = useRef("");
  const attemptedPayload = useRef("");
  useEffect(() => {
    setName(""); setMessage(""); setWebsite(""); setVariants([]); setSelected(null); setSent(false); setError(""); setBusy(null);
    requestId.current = ""; attemptedPayload.current = "";
    return () => { active.current?.abort(); active.current = null; };
  }, [slug]);

  async function send(kind: "ai" | "submit") {
    if (active.current) return;
    setError("");
    if (message.trim().length < 3) { setError("Adaugă câteva cuvinte despre experiența ta, iar AI-ul va dezvolta ideea într-o recenzie mai expresivă."); return; }
    const controller = new AbortController();
    active.current = controller;
    setBusy(kind);
    const timeout = window.setTimeout(() => controller.abort(), kind === "ai" ? 60_000 : 30_000);
    try {
      const payload = JSON.stringify({ name: name.trim(), message: message.trim() });
      // Reîncercarea aceleiași trimiteri folosește același ID; textul nou are alt ID.
      if (kind === "submit" && attemptedPayload.current !== payload) {
        requestId.current = crypto.randomUUID();
        attemptedPayload.current = payload;
      }
      const response = await fetch(`/api/feedback/${encodeURIComponent(slug)}${kind === "ai" ? "/variants" : ""}`, {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "ai" ? { message } : { name, message, requestId: requestId.current, website }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cererea nu a putut fi trimisă.");
      if (active.current !== controller) return;
      if (kind === "ai") {
        if (!Array.isArray(data.variants) || data.variants.length !== FEEDBACK_VARIANT_COUNT || data.variants.some((value: unknown) => typeof value !== "string" || !value.trim())) throw new Error("Nu am primit variantele. Încearcă din nou sau scrie feedback-ul direct.");
        setVariants(data.variants); setSelected(null);
        window.setTimeout(() => variantsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      } else if (data.ok === true) {
        setSent(true);
      } else {
        throw new Error("Trimiterea nu a fost confirmată. Încearcă din nou.");
      }
    } catch (err) {
      if (active.current !== controller) return;
      setError(controller.signal.aborted ? "Cererea durează prea mult. Textul tău este păstrat; încearcă din nou." : err instanceof Error ? err.message : "Eroare de conexiune. Încearcă din nou.");
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(null); }
    }
  }
  const fieldClass = "mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60";
  return <div className="min-h-screen bg-neutral-950 text-neutral-100 px-5 py-10 sm:py-16">
    <Helmet><title>Feedback | AncaVisuals</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <main className="max-w-2xl mx-auto">
      <Link to="/" className="text-sm tracking-[0.2em] text-amber-200">ANCA VISUALS</Link>
      {!isFeedbackSlug(slug) ? <p role="alert" className="mt-10">Linkul de feedback nu este valid.</p> : sent ? <section className="mt-12 rounded-2xl border border-amber-200/30 bg-neutral-900 p-8" role="status">
        <h1 className="text-3xl font-light">Mulțumim pentru feedback!</h1>
        <p className="mt-4 text-neutral-300">Am primit mesajul tău. Ne ajută să înțelegem ce a mers bine și ce putem îmbunătăți.</p>
        <Link className="inline-block mt-6 text-amber-200 underline underline-offset-4" to={`/media/${encodeURIComponent(slug)}`}>Înapoi la album</Link>
      </section> : <>
        <header className="mt-10 mb-8"><p className="text-xs uppercase tracking-widest text-neutral-400">Dacă doriți să ne spuneți</p>
          <h1 className="mt-3 text-4xl font-light">Cum au decurs serviciile?</h1>
          <p className="mt-4 text-neutral-300 leading-relaxed">Dacă aveți câteva clipe, ne puteți da câteva cuvinte despre cum au decurs serviciile. Ne ajută să știm ce a fost bine și unde putem deveni mai buni.</p>
        </header>
        <form onSubmit={event => { event.preventDefault(); void send("submit"); }} className="space-y-6">
          <label className="block">Numele tău <span className="text-sm text-neutral-500">(opțional)</span><input autoComplete="name" maxLength={FEEDBACK_NAME_LIMIT} value={name} onChange={event => setName(event.target.value)} disabled={busy !== null} className={fieldClass} /></label>
          <div>
            <label className="block" htmlFor="feedback-message">Câteva cuvinte despre cum au decurs serviciile</label>
            {error && <p role="alert" className="mt-3 rounded-xl bg-red-950/40 border border-red-900 p-4 text-red-200">{error}</p>}
            <textarea id="feedback-message" required minLength={3} maxLength={FEEDBACK_MESSAGE_LIMIT} rows={5} placeholder="Dacă doriți, ne puteți spune pe scurt cum a fost colaborarea cu noi." value={message} onChange={event => { setMessage(event.target.value); setVariants([]); setSelected(null); }} disabled={busy !== null} className={fieldClass} />
            <p className="mt-2 text-xs text-neutral-400">{message.length}/{FEEDBACK_MESSAGE_LIMIT}</p>
          </div>
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
          <div className="rounded-xl border border-neutral-800 p-4">
            <button type="button" disabled={busy !== null} onClick={() => void send("ai")} className="rounded-lg border border-amber-200/50 px-4 py-3 text-amber-200 hover:bg-amber-200/10 disabled:opacity-40">{busy === "ai" ? "Claude pregătește variantele…" : "Ajută-mă să formulez cu AI"}</button>
            <p aria-live="polite" className={variants.length > 0 ? "mt-3 rounded-xl border border-emerald-400/50 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100" : "text-sm text-neutral-400 mt-3"}>{variants.length > 0 ? <>Am pregătit câteva exemple cu ajutorul AI, dezvoltând ideea ta într-un mod mai cald, sincer și expresiv. <strong className="mt-2 block text-emerald-200">↓ Alege varianta care te reprezintă cel mai bine mai jos.</strong></> : "Dacă vrei, AI-ul îți poate dezvolta ideea într-o recenzie mai caldă, sinceră și expresivă. Alegi o variantă, o modifici cum dorești și o trimiți doar dacă te reprezintă."}</p>
          </div>
          {variants.length > 0 && <fieldset ref={variantsRef} className="scroll-mt-6 space-y-3"><legend className="mb-3 text-lg">Câteva variante pe care le poți folosi</legend>
            {variants.map((variant, index) => <label key={index} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${selected === index ? "border-amber-200 bg-amber-200/5" : "border-neutral-700 bg-neutral-900"}`}>
              <input className="mt-1 accent-amber-200" type="radio" name="feedback-variant" checked={selected === index} disabled={busy !== null} onChange={() => { setSelected(index); setMessage(variant); }} aria-label={`Varianta ${index + 1}`} />
              <span className="text-sm leading-relaxed whitespace-pre-wrap"><span className="block text-amber-200 text-xs mb-2">Varianta {index + 1}</span>{variant}</span>
            </label>)}
            {selected !== null && <p className="text-sm text-neutral-300">Alege o variantă doar dacă te reprezintă. Textul este în câmpul de mai sus și îl poți edita înainte să-l trimiți.</p>}
          </fieldset>}
          <button type="submit" disabled={busy !== null} className="w-full rounded-xl bg-amber-200 px-6 py-4 font-medium text-black hover:bg-amber-100 disabled:opacity-50">{busy === "submit" ? "Se trimite…" : "Trimite feedback-ul"}</button>
          <p className="text-sm text-neutral-400">Mesajul ajunge la echipa AncaVisuals și nu este publicat automat. <Link to="/privacy" className="underline">Confidențialitate</Link></p>
        </form>
      </>}
    </main>
  </div>;
}
