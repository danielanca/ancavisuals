import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type PageState = "loading" | "not-found" | "form" | "submitting" | "success" | "error";

type EventInfo = {
  eventId: string;
  eventType: string | null;
  eventDate: string | null;
};

const inputClass =
  "w-full bg-white/5 text-white text-sm placeholder-white/25 border border-white/12 rounded-2xl px-4 py-3.5 outline-none focus:border-white/35 transition-colors";

const FotocabinaPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setPageState("not-found"); return; }
    fetch(`/api/photobooth/by-slug/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (response.status === 404) { setPageState("not-found"); return null; }
        if (!response.ok) throw new Error("server error");
        return response.json();
      })
      .then((data: EventInfo | null) => {
        if (data) { setEventInfo(data); setPageState("form"); }
      })
      .catch(() => setPageState("not-found"));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!name.trim()) { setFieldError("Numele este obligatoriu."); return; }
    if (!email.trim() && !phone.trim()) { setFieldError("Completează cel puțin un email sau un număr de telefon."); return; }
    if (!gdpr) { setFieldError("Trebuie să accepți procesarea datelor pentru a continua."); return; }
    if (!eventInfo) return;

    setPageState("submitting");

    try {
      const response = await fetch(`/api/photobooth/${eventInfo.eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          gdprConsent: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) { setFieldError(data.error ?? "Eroare. Încearcă din nou."); setPageState("form"); return; }
      setPageState("success");
    } catch {
      setFieldError("Eroare de rețea. Încearcă din nou.");
      setPageState("form");
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  if (pageState === "not-found") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-5">📷</p>
          <h1 className="text-white text-lg font-semibold mb-2">Eveniment negăsit</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Linkul poate fi incorect sau evenimentul nu a fost configurat încă.
          </p>
          <p className="text-white/20 text-xs mt-6 font-mono">/fotocabina/{slug}</p>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-6">✅</p>
          <h1 className="text-white text-xl font-bold mb-3">Înregistrat!</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Vei primi pozele de la fotocabină pe {email && phone ? "email și telefon" : email ? "email" : "telefon"} imediat ce sunt gata.
          </p>
          <p className="text-white/20 text-xs mt-8">AncaVisuals · ancavisuals.ro</p>
        </div>
      </div>
    );
  }

  const isSubmitting = pageState === "submitting";

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-[360px]">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-3xl mb-4">📸</p>
          <h1 className="text-white text-xl font-bold tracking-tight mb-2">
            Primește pozele tale
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Lasă emailul sau numărul de telefon și îți trimitem pozele de la fotocabină când sunt gata.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-3">

          <div>
            <input
              className={inputClass}
              type="text"
              placeholder="Numele tău *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div>
            <input
              className={inputClass}
              type="email"
              placeholder="Email (ex: maria@gmail.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-white/25 text-xs uppercase tracking-widest">sau</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <div>
            <input
              className={inputClass}
              type="tel"
              placeholder="Telefon (ex: 0740 123 456)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              disabled={isSubmitting}
            />
          </div>

          {/* GDPR */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 mt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={gdpr}
                  onChange={(e) => setGdpr(e.target.checked)}
                  disabled={isSubmitting}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                    gdpr ? "bg-amber-400 border-amber-400" : "bg-transparent border-white/25"
                  }`}
                >
                  {gdpr && (
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                      <polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-white/40 text-xs leading-relaxed">
                Sunt de acord cu prelucrarea datelor mele personale (email / telefon) exclusiv în scopul primirii
                pozelor de la fotocabina AncaVisuals. Datele nu vor fi transmise terților și nu vor fi folosite
                în alt scop.
              </span>
            </label>
          </div>

          {fieldError && (
            <p className="text-red-400 text-xs bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-3">
              {fieldError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50 transition-all mt-1"
          >
            {isSubmitting ? "Se trimite..." : "Trimite-mi pozele"}
          </button>
        </form>

        <p className="text-center text-white/15 text-xs mt-8">AncaVisuals · ancavisuals.ro</p>
      </div>
    </div>
  );
};

export default FotocabinaPage;
