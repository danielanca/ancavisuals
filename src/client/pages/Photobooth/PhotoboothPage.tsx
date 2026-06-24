import React, { useState } from "react";
import { useParams } from "react-router-dom";

type FormState = {
  name: string;
  email: string;
  phone: string;
  gdprConsent: boolean;
};

type SubmitState = "idle" | "loading" | "success" | "error";

const inputClass =
  "w-full bg-white/5 text-white text-sm placeholder-white/30 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-white/40 transition-colors";
const labelClass = "block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-widest";

const PhotoboothPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    gdprConsent: false,
  });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setField =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setErrorMessage("Numele este obligatoriu.");
      return;
    }

    if (!form.gdprConsent) {
      setErrorMessage("Trebuie să accepți prelucrarea datelor pentru a continua.");
      return;
    }

    const hasEmail = form.email.trim().length > 0;
    const hasPhone = form.phone.trim().length > 0;

    if (!hasEmail && !hasPhone) {
      setErrorMessage("Completează cel puțin un email sau un număr de telefon.");
      return;
    }

    setSubmitState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/photobooth/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: hasEmail ? form.email.trim() : undefined,
          phone: hasPhone ? form.phone.trim() : undefined,
          gdprConsent: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Eroare la înregistrare.");
      }

      setSubmitState("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Eroare. Încearcă din nou.");
      setSubmitState("error");
    }
  };

  if (submitState === "success") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-6">📸</div>
          <h1 className="text-white text-2xl font-bold mb-3">Înregistrat cu succes!</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Vei primi un mesaj când pozele tale de la fotocabină sunt gata.
          </p>
          <div className="mt-8 text-white/20 text-xs">AncaVisuals</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-start justify-center px-4 pt-12 pb-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">📷</div>
          <h1 className="text-white text-xl font-bold mb-2">Fotocabină AncaVisuals</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Lasă-ne datele tale și te anunțăm când pozele sunt gata.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className={labelClass}>Nume *</label>
            <input
              className={inputClass}
              placeholder="Numele tău"
              value={form.name}
              onChange={setField("name")}
              autoComplete="name"
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              className={inputClass}
              type="email"
              placeholder="adresa@email.com"
              value={form.email}
              onChange={setField("email")}
              autoComplete="email"
            />
          </div>

          <div>
            <label className={labelClass}>Telefon</label>
            <input
              className={inputClass}
              type="tel"
              placeholder="07xx xxx xxx"
              value={form.phone}
              onChange={setField("phone")}
              autoComplete="tel"
            />
          </div>

          <p className="text-white/30 text-xs text-center">
            Completează cel puțin un email sau un număr de telefon.
          </p>

          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.03]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gdprConsent}
                onChange={setField("gdprConsent")}
                className="mt-0.5 w-4 h-4 accent-amber-400 shrink-0"
              />
              <span className="text-white/50 text-xs leading-relaxed">
                Sunt de acord cu prelucrarea datelor mele personale (email / telefon) exclusiv
                în scopul livrării pozelor de la fotocabină. Datele nu vor fi folosite în
                niciun alt scop și nu vor fi transmise terților.
              </span>
            </label>
          </div>

          {errorMessage && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitState === "loading"}
            className="w-full py-3.5 rounded-xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 disabled:opacity-50 transition-colors"
          >
            {submitState === "loading" ? "Se înregistrează..." : "Înregistrează-mă"}
          </button>
        </form>

        <p className="text-center text-white/20 text-xs mt-8">AncaVisuals · ancavisuals.ro</p>
      </div>
    </div>
  );
};

export default PhotoboothPage;
