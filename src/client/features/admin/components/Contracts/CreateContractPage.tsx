import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface CreateContractState {
  eventId?: string;
  eventType?: string;
  eventDate?: string;
  eventLocation?: string;
  clientEmail?: string;
  clientPhone?: string;
}

interface ServiceEntry {
  id: string;
  label: string;
  included: boolean;
  priceRaw: string; // "500", "GRATUIT", sau "" (necompletat)
}

// Prețuri precompletate din prices.json
const DEFAULT_SERVICES: ServiceEntry[] = [
  { id: "foto_video", label: "Foto + Video (1 fotograf + 1 videograf)", included: false, priceRaw: "800"  },
  { id: "foto",       label: "1 persoană responsabilă de foto",          included: false, priceRaw: "500"  },
  { id: "video",      label: "1 persoană responsabilă de video",         included: false, priceRaw: "300"  },
  { id: "foto2",      label: "2 persoane responsabile de foto",          included: false, priceRaw: "1000" },
  { id: "video2",     label: "2 persoane responsabile de video",         included: false, priceRaw: "600"  },
  { id: "album100",   label: "Album 100 poze 10×15 cm",                  included: false, priceRaw: "40"   },
  { id: "usb",        label: "USB Stick cu toate materialele",            included: false, priceRaw: ""     },
  { id: "photobooth", label: "Fotocabină / Photo Booth",                 included: false, priceRaw: "250"  },
  { id: "videobooth", label: "Video Cabină 360 / VideoBooth",            included: false, priceRaw: "250"  },
  { id: "teaser",     label: "Teaser video (1–2 min)",                   included: false, priceRaw: ""     },
  { id: "transport",  label: "Taxă transport spre și de la eveniment",   included: false, priceRaw: ""     },
];

const EVENT_TYPES = ["Nuntă", "Botez", "Logodnă", "Majorat", "Corporate", "Ședință foto", "Altul"];
const CURRENCIES = ["RON", "EUR"];
const PAYMENT_METHODS = ["Transfer bancar", "Cash", "Card", "Revolut"];

// Interpretează valoarea câmpului de preț
function parsePrice(raw: string): number | "gratuit" | "missing" {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === "GRATUIT") return "gratuit";
  if (trimmed === "") return "missing";
  const n = parseFloat(trimmed.replace(",", "."));
  return isNaN(n) ? "missing" : n;
}

function priceToNumeric(raw: string): number {
  const p = parsePrice(raw);
  if (p === "gratuit" || p === "missing") return 0;
  return p;
}

function convertAmount(amount: number, currency: string, eurRate: number): string {
  if (amount === 0) return "";
  if (currency === "RON") {
    const eur = eurRate > 0 ? (amount / eurRate).toFixed(0) : "?";
    return `≈ ${eur} EUR`;
  } else {
    const ron = eurRate > 0 ? (amount * eurRate).toFixed(0) : "?";
    return `≈ ${ron} RON`;
  }
}

const CreateContractPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromEvent = (location.state as CreateContractState | null) ?? {};

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serviceErrors, setServiceErrors] = useState<Set<string>>(new Set());

  // Eveniment
  const [eventType, setEventType] = useState(fromEvent.eventType ?? "");
  const [eventDate, setEventDate] = useState(fromEvent.eventDate ?? "");
  const [eventLocation, setEventLocation] = useState(fromEvent.eventLocation ?? "");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  // Servicii
  const [services, setServices] = useState<ServiceEntry[]>(DEFAULT_SERVICES);
  const [customServices, setCustomServices] = useState<{ label: string; priceRaw: string }[]>([]);

  // Curs valutar
  const [eurRate, setEurRate] = useState<number>(5);

  // Prețuri
  const [currency, setCurrency] = useState("RON");
  const [manualTotal, setManualTotal] = useState(false);
  const [priceTotal, setPriceTotal] = useState(0);
  const [priceAdvance, setPriceAdvance] = useState(0);
  const [advancePaidAt, setAdvancePaidAt] = useState("");
  const [restPaidAt, setRestPaidAt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Transfer bancar");

  // Transport
  const [transportKm, setTransportKm] = useState("");
  const [transportFuelPrice, setTransportFuelPrice] = useState("10");

  // Client
  const [clientEmail, setClientEmail] = useState(fromEvent.clientEmail ?? "");
  const [privateClient, setPrivateClient] = useState(false);

  // Calculated totals (GRATUIT = 0, missing = 0 dar va fi validat)
  const selectedServices = services.filter((s) => s.included);
  const customTotal = customServices.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0);
  const autoTotal = selectedServices.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0) + customTotal;
  const effectiveTotal = manualTotal ? priceTotal : autoTotal;
  const priceRest = Math.max(0, effectiveTotal - (priceAdvance || 0));

  // Auto-actualizează prețul transport când km / preț carburant se schimbă
  useEffect(() => {
    const km = parseFloat(transportKm);
    const fuel = parseFloat(transportFuelPrice);
    if (!isNaN(km) && km > 0 && !isNaN(fuel) && fuel > 0) {
      const estimated = Math.ceil(km * 6 / 100 * fuel).toString();
      setServices((prev) => prev.map((s) => s.id === "transport" ? { ...s, priceRaw: estimated } : s));
    }
  }, [transportKm, transportFuelPrice]);

  const toggleService = (id: string) => {
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, included: !s.included } : s));
    setServiceErrors((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const setServicePriceRaw = (id: string, raw: string) => {
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, priceRaw: raw } : s));
    setServiceErrors((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const addCustomService = () => {
    setCustomServices((prev) => [...prev, { label: "", priceRaw: "" }]);
  };

  const removeCustomService = (i: number) => {
    setCustomServices((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!eventType) { setSubmitError("Selectează tipul evenimentului."); return; }
    if (!eventDate) { setSubmitError("Data evenimentului este obligatorie."); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(eventDate) < today) { setSubmitError("Data evenimentului nu poate fi în trecut."); return; }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      setSubmitError("Email-ul clientului este obligatoriu și trebuie să fie valid."); return;
    }

    // Validare prețuri servicii bifate — trebuie completat sau GRATUIT
    const missing = new Set<string>();
    selectedServices.forEach((s) => {
      if (parsePrice(s.priceRaw) === "missing") missing.add(s.id);
    });
    customServices.forEach((s, i) => {
      if (s.label.trim() && parsePrice(s.priceRaw) === "missing") missing.add(`custom_${i}`);
    });
    if (missing.size > 0) {
      setServiceErrors(missing);
      setSubmitError("Completează prețul (sau scrie GRATUIT) pentru serviciile bifate marcate în roșu.");
      return;
    }

    setLoading(true);
    try {
      const allServices = [
        ...selectedServices.map((s) => ({
          label: s.label,
          price: priceToNumeric(s.priceRaw),
          gratuit: parsePrice(s.priceRaw) === "gratuit",
          ...(s.id === "transport" ? { isTransport: true } : {}),
        })),
        ...customServices
          .filter((s) => s.label.trim())
          .map((s) => ({
            label: s.label,
            price: priceToNumeric(s.priceRaw),
            gratuit: parsePrice(s.priceRaw) === "gratuit",
          })),
      ];

      const payload = {
        eventType, eventDate, eventLocation, eventStartTime, eventEndTime, eventDetails,
        services: allServices,
        currency,
        eurRate,
        priceTotal: effectiveTotal,
        priceAdvance: priceAdvance || 0,
        priceRest,
        advancePaidAt,
        restPaidAt,
        paymentMethod,
        clientEmail,
        privateClient,
        transportKm: transportKm || "",
        transportFuelPrice: transportFuelPrice || "10",
        eventId: fromEvent.eventId ?? null,
      };

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Eroare la creare");
      // Dacă a venit de la un eveniment, întoarce-te la admin ca să se re-încarce evenimentele
      navigate(fromEvent.eventId ? "/admin" : "/admin/contracts");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  const otherCurrency = currency === "RON" ? "EUR" : "RON";

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <button type="button" onClick={() => navigate("/admin/contracts")}
            className="text-neutral-400 hover:text-white transition-colors text-sm">
            ← Înapoi
          </button>
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Contract nou</h1>
            <p className="text-neutral-400 text-sm mt-0.5">
              {fromEvent.eventId
                ? <span className="text-emerald-400">Pre-completat din eveniment ↗</span>
                : "Completează detaliile — clientul va semna prin link"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* EVENIMENT */}
          <Block title="Eveniment">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tip eveniment *</Label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={sel}>
                  <option value="">Selectează...</option>
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>Data evenimentului *</Label>
                <input
                  type="date"
                  value={eventDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setEventDate(e.target.value)}
                  className={inp}
                />
              </div>
            </div>
            <div>
              <Label>Locație</Label>
              <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Restaurant Panoramic, Cluj-Napoca" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ora de început</Label>
                <input type="time" value={eventStartTime} onChange={(e) => setEventStartTime(e.target.value)} className={inp} />
              </div>
              <div>
                <Label>Ora de sfârșit</Label>
                <input type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <Label>Mențiuni suplimentare</Label>
              <textarea value={eventDetails} onChange={(e) => setEventDetails(e.target.value)}
                rows={2} placeholder="Orice detalii relevante..." className={inp} />
            </div>
          </Block>

          {/* SERVICII */}
          <Block title="Servicii incluse">

            {/* Curs valutar + monedă — deasupra checkboxurilor */}
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-800 mb-1">
              <div className="flex items-center gap-2">
                <Label>Monedă</Label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500/50">
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">1 EUR =</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={eurRate}
                  onChange={(e) => setEurRate(parseFloat(e.target.value) || 5)}
                  className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 text-center focus:outline-none focus:border-emerald-500/50"
                />
                <span className="text-xs text-neutral-500">RON</span>
              </div>
              <span className="text-xs text-neutral-600 ml-auto">
                Prețurile sunt în {currency} · conversie afișată în {otherCurrency}
              </span>
            </div>

            {/* Lista servicii */}
            <div className="space-y-1">
              {services.map((s) => {
                const parsed = parsePrice(s.priceRaw);
                const isGratuit = parsed === "gratuit";
                const isMissing = serviceErrors.has(s.id);
                const numericPrice = typeof parsed === "number" ? parsed : 0;
                const conversion = typeof parsed === "number" && parsed > 0
                  ? convertAmount(parsed, currency, eurRate)
                  : "";

                return (
                  <div key={s.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isMissing ? "bg-red-500/10" : ""}`}>
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={s.included}
                        onChange={() => toggleService(s.id)}
                        className="accent-emerald-500 shrink-0"
                      />
                      <span className={`text-xs leading-tight ${s.included ? "text-neutral-200" : "text-neutral-500"}`}>
                        {s.label}
                      </span>
                    </label>

                    {s.included && s.id === "transport" ? (
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <input
                          type="number"
                          min="0"
                          value={transportKm}
                          onChange={(e) => setTransportKm(e.target.value)}
                          placeholder="km"
                          className="w-16 rounded px-2 py-1 text-xs text-right bg-neutral-700 border border-neutral-600 text-neutral-100 placeholder-neutral-500 focus:outline-none"
                        />
                        <span className="text-xs text-neutral-500">km ×</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={transportFuelPrice}
                          onChange={(e) => setTransportFuelPrice(e.target.value)}
                          className="w-14 rounded px-2 py-1 text-xs text-right bg-neutral-700 border border-neutral-600 text-neutral-100 focus:outline-none"
                        />
                        <span className="text-xs text-neutral-500">lei/L =</span>
                        <span className="text-xs text-amber-400 font-medium">
                          ~{s.priceRaw || "0"} {currency}
                        </span>
                      </div>
                    ) : s.included && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conversion && (
                          <span className="text-xs text-neutral-600">{conversion}</span>
                        )}
                        <input
                          type="text"
                          value={s.priceRaw}
                          onChange={(e) => setServicePriceRaw(s.id, e.target.value)}
                          placeholder="Preț / GRATUIT"
                          className={`w-28 rounded px-2 py-1 text-xs text-right focus:outline-none transition-colors ${
                            isMissing
                              ? "bg-red-500/20 border border-red-500/50 text-red-300 placeholder-red-400/50"
                              : isGratuit
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                              : "bg-neutral-700 border border-neutral-600 text-neutral-100 placeholder-neutral-500"
                          }`}
                        />
                        <span className="text-xs text-neutral-600">{currency}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Servicii custom */}
            {customServices.length > 0 && (
              <div className="space-y-2 mt-3">
                {customServices.map((s, i) => {
                  const parsed = parsePrice(s.priceRaw);
                  const isGratuit = parsed === "gratuit";
                  const isMissing = serviceErrors.has(`custom_${i}`);
                  const conversion = typeof parsed === "number" && parsed > 0
                    ? convertAmount(parsed, currency, eurRate)
                    : "";
                  return (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={s.label}
                        onChange={(e) => setCustomServices((prev) => prev.map((cs, ci) => ci === i ? { ...cs, label: e.target.value } : cs))}
                        placeholder="Denumire serviciu"
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none"
                      />
                      {conversion && <span className="text-xs text-neutral-600 shrink-0">{conversion}</span>}
                      <input
                        type="text"
                        value={s.priceRaw}
                        onChange={(e) => setCustomServices((prev) => prev.map((cs, ci) => ci === i ? { ...cs, priceRaw: e.target.value } : cs))}
                        placeholder="Preț / GRATUIT"
                        className={`w-28 rounded-lg px-3 py-2 text-sm text-right focus:outline-none transition-colors ${
                          isMissing
                            ? "bg-red-500/20 border border-red-500/50 text-red-300"
                            : isGratuit
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-neutral-800 border border-neutral-700 text-neutral-100"
                        }`}
                      />
                      <span className="text-xs text-neutral-600">{currency}</span>
                      <button type="button" onClick={() => removeCustomService(i)} className="text-neutral-600 hover:text-red-400 text-xl shrink-0">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={addCustomService}
              className="mt-3 text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-1.5 hover:bg-emerald-500/10 transition-colors">
              + Adaugă serviciu custom
            </button>
          </Block>

          {/* PREȚURI */}
          <Block title="Prețuri">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-1">
                <Label>Total ({currency})</Label>
                <label className="flex items-center gap-1 cursor-pointer text-xs text-neutral-500">
                  <input type="checkbox" checked={manualTotal} onChange={(e) => setManualTotal(e.target.checked)} className="accent-emerald-500" />
                  manual
                </label>
              </div>
              {manualTotal ? (
                <input type="number" min="0" value={priceTotal || ""} onChange={(e) => setPriceTotal(Number(e.target.value))} className={inp} />
              ) : (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 flex items-center justify-between">
                  <span>{autoTotal} {currency}</span>
                  <span className="text-neutral-500 text-xs">
                    {convertAmount(autoTotal, currency, eurRate) || "(suma serviciilor)"}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Avans ({currency})</Label>
                <input type="number" min="0" value={priceAdvance || ""} onChange={(e) => setPriceAdvance(Number(e.target.value))} className={inp} />
              </div>
              <div>
                <Label>Scadență avans</Label>
                <input type="date" value={advancePaidAt} onChange={(e) => setAdvancePaidAt(e.target.value)} className={inp} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300 flex items-center justify-between">
                <span>Rest de plată</span>
                <span className="text-white font-semibold">{priceRest} {currency}</span>
              </div>
              <div>
                <Label>Scadență rest</Label>
                <input type="date" value={restPaidAt} onChange={(e) => setRestPaidAt(e.target.value)} className={inp} />
              </div>
            </div>

            <div>
              <Label>Metodă de plată</Label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={sel}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            {/* Overview plăți */}
            {effectiveTotal > 0 && (
              <div className="rounded-xl border border-neutral-700 overflow-hidden text-sm mt-2">
                <div className="bg-neutral-800/60 px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider font-medium">
                  Rezumat plăți pentru client
                </div>
                <div className="divide-y divide-neutral-800">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-neutral-200 font-medium">Total contract</div>
                    </div>
                    <div className="text-white font-bold text-base">{effectiveTotal} {currency}</div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/5">
                    <div>
                      <div className="text-neutral-200">De plătit acum <span className="text-emerald-400 font-medium">(avans)</span></div>
                      {advancePaidAt && <div className="text-xs text-neutral-500 mt-0.5">Scadent: {advancePaidAt}</div>}
                    </div>
                    <div className="text-emerald-400 font-semibold">{priceAdvance || 0} {currency}</div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-neutral-200">Rest de plătit <span className="text-neutral-400">(la/după eveniment)</span></div>
                      {restPaidAt && <div className="text-xs text-neutral-500 mt-0.5">Scadent: {restPaidAt}</div>}
                    </div>
                    <div className="text-neutral-100 font-semibold">{priceRest} {currency}</div>
                  </div>
                </div>
              </div>
            )}
          </Block>

          {/* CLIENT */}
          <Block title="Email client">
            <div>
              <Label>Email client *</Label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@email.com" className={inp} />
              <span className="text-neutral-500 text-xs mt-1 block">
                Link-ul de semnare va fi trimis la această adresă.
              </span>
            </div>
            <label className="flex items-center gap-3 mt-4 cursor-pointer group">
              <input
                type="checkbox"
                checked={privateClient}
                onChange={(e) => setPrivateClient(e.target.checked)}
                className="accent-amber-500 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-amber-400 group-hover:text-amber-300 transition-colors">
                Clientul dorește pozele/video să fie private
                <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                  Bifează dacă nu ai voie să postezi materialele pe social media / portofoliu
                </span>
              </span>
            </label>
          </Block>

          {submitError && <p className="text-red-400 text-sm text-center">{submitError}</p>}

          <div className="flex gap-3 pb-4">
            <button type="button" onClick={() => navigate("/admin/contracts")}
              className="flex-1 py-3 border border-neutral-700 text-neutral-400 rounded-xl text-sm hover:border-neutral-500 transition-colors">
              Anulează
            </button>
            <button type="submit" disabled={loading}
              className="flex-[2] py-3 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Se salvează..." : "Salvează contractul"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
    <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">{title}</h3>
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{children}</div>
);

const inp = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-neutral-600";
const sel = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-colors";

export default CreateContractPage;
