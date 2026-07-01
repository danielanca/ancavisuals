import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BankProfile } from "../../types";

interface ServiceEntry {
  id: string;
  label: string;
  included: boolean;
  priceRaw: string;
}

interface SavedService {
  label: string;
  price: number;
  gratuit?: boolean;
  isTransport?: boolean;
}

const TRANSPORT_SERVICE_ID = "transport";

const DEFAULT_SERVICES: ServiceEntry[] = [
  { id: "foto_video", label: "Foto + Video (1 fotograf + 1 videograf)", included: false, priceRaw: "800" },
  { id: "foto_video_1", label: "Foto + Video (1 persoană)",             included: false, priceRaw: "600" },
  { id: "foto",       label: "1 persoană responsabilă de foto",          included: false, priceRaw: "500" },
  { id: "video",      label: "1 persoană responsabilă de video",         included: false, priceRaw: "300" },
  { id: "foto2",      label: "2 persoane responsabile de foto",          included: false, priceRaw: "1000" },
  { id: "video2",     label: "2 persoane responsabile de video",         included: false, priceRaw: "600" },
  { id: "album100",   label: "Album 100 poze 10×15 cm",                  included: false, priceRaw: "40" },
  { id: "usb",        label: "USB Stick cu toate materialele",            included: false, priceRaw: "" },
  { id: "photobooth", label: "Fotocabină / Photo Booth",                 included: false, priceRaw: "250" },
  { id: "videobooth", label: "Video Cabină 360 / VideoBooth",            included: false, priceRaw: "250" },
  { id: "teaser",     label: "Teaser video (1–2 min)",                   included: false, priceRaw: "" },
  { id: TRANSPORT_SERVICE_ID,  label: "Taxă transport spre și de la eveniment",   included: false, priceRaw: "" },
];

const EVENT_TYPES = [
  "Nuntă",
  "Cununie civilă",
  "Botez",
  "Logodnă",
  "Majorat",
  "Corporate",
  "Fotocabină / VideoBooth",
  "Ședință foto",
  "Înmormântare",
  "Altul",
];
const CURRENCIES = ["RON", "EUR"];
const DEFAULT_CURRENCY = "RON";
const BANK_TRANSFER = "Transfer bancar";
const CASH = "Cash";
const CARD = "Card";
const REVOLUT = "Revolut";
const PAYMENT_METHODS = [BANK_TRANSFER, CASH, CARD, REVOLUT];
const DEFAULT_EUR_RATE = 5;
const DEFAULT_TRANSPORT_FUEL_PRICE = "10";

function parseDecimal(raw: string): number {
  const num = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return isNaN(num) ? 0 : num;
}

function formatDecimal(value: number): string {
  return value === 0 ? "" : String(value).replace(".", ",");
}

function DecimalInput({
  value, onChange, step = 0.05, className, placeholder,
}: { value: number; onChange: (v: number) => void; step?: number; className?: string; placeholder?: string }) {
  const [raw, setRaw] = React.useState(formatDecimal(value));
  React.useEffect(() => {
    if (parseDecimal(raw) !== value) setRaw(formatDecimal(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input type="text" inputMode="decimal" value={raw} placeholder={placeholder}
      onChange={(e) => { setRaw(e.target.value); onChange(parseDecimal(e.target.value)); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.max(0, Math.round((value + (e.key === "ArrowUp" ? step : -step)) * 10000) / 10000);
          onChange(next); setRaw(formatDecimal(next));
        }
      }}
      onBlur={() => { const n = parseDecimal(raw); setRaw(n === 0 ? "" : formatDecimal(n)); onChange(n); }}
      className={className}
    />
  );
}

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

function populateServices(saved: SavedService[]): ServiceEntry[] {
  return DEFAULT_SERVICES.map((s) => {
    const match = saved.find((cs) => cs.label === s.label);
    if (match) {
      return {
        ...s,
        included: true,
        priceRaw: match.gratuit ? "GRATUIT" : String(match.price),
      };
    }
    return s;
  });
}

function getCustomServices(saved: SavedService[]): { label: string; priceRaw: string }[] {
  const defaultLabels = new Set(DEFAULT_SERVICES.map((s) => s.label));
  return saved
    .filter((cs) => !defaultLabels.has(cs.label))
    .map((cs) => ({ label: cs.label, priceRaw: cs.gratuit ? "GRATUIT" : String(cs.price) }));
}

const EditContractPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serviceErrors, setServiceErrors] = useState<Set<string>>(new Set());

  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  const [services, setServices] = useState<ServiceEntry[]>(DEFAULT_SERVICES);
  const [customServices, setCustomServices] = useState<{ label: string; priceRaw: string }[]>([]);
  const [eurRate, setEurRate] = useState<number>(DEFAULT_EUR_RATE);

  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [manualTotal, setManualTotal] = useState(false);
  const [priceTotal, setPriceTotal] = useState(0);
  const [noAdvance, setNoAdvance] = useState(false);
  const [priceAdvance, setPriceAdvance] = useState(0);
  const [advancePaidAt, setAdvancePaidAt] = useState("");
  const [restPaidAt, setRestPaidAt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(BANK_TRANSFER);
  const [bankProfiles, setBankProfiles] = useState<BankProfile[]>([]);
  const [selectedBankProfileId, setSelectedBankProfileId] = useState("");

  const [transportKm, setTransportKm] = useState("");
  const [transportFuelPrice, setTransportFuelPrice] = useState(DEFAULT_TRANSPORT_FUEL_PRICE);

  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientCounty, setClientCounty] = useState("");
  const [clientIdSeries, setClientIdSeries] = useState("");
  const [privateClient, setPrivateClient] = useState(false);
  const [fiscalized, setFiscalized] = useState(false);
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      fetch(`/api/contracts/${id}`).then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ])
      .then(([data, settings]) => {
        if (data.error) throw new Error(data.error);

        let profiles: BankProfile[] = Array.isArray(settings.bankProfiles) ? settings.bankProfiles : [];
        if (profiles.length === 0 && (settings.bankDetails?.beneficiaryName || settings.bankDetails?.iban)) {
          profiles = [{
            id: "legacy",
            label: "Cont principal",
            beneficiaryName: settings.bankDetails.beneficiaryName ?? "",
            iban: settings.bankDetails.iban ?? "",
          }];
        }
        setBankProfiles(profiles);

        setEventType(data.eventType ?? "");
        setEventDate(data.eventDate ?? "");
        setEventLocation(data.eventLocation ?? "");
        setEventStartTime(data.eventStartTime ?? "");
        setEventEndTime(data.eventEndTime ?? "");
        setEventDetails(data.eventDetails ?? "");

        const savedServices: SavedService[] = Array.isArray(data.services) ? data.services : [];
        const populated = populateServices(savedServices);
        const customSvcs = getCustomServices(savedServices);
        setServices(populated);
        setCustomServices(customSvcs);

        setCurrency(data.currency ?? DEFAULT_CURRENCY);
        setEurRate(data.eurRate ?? DEFAULT_EUR_RATE);
        const total = Number(data.priceTotal) || 0;
        const advance = Number(data.priceAdvance) || 0;
        setPriceTotal(total);
        setPriceAdvance(advance);
        setAdvancePaidAt(data.advancePaidAt ?? "");
        setRestPaidAt(data.restPaidAt ?? "");
        setPaymentMethod(data.paymentMethod ?? BANK_TRANSFER);

        const savedIban = (data.bankIban ?? "").trim().toUpperCase();
        const matchedProfile = profiles.find((p) => p.iban.trim().toUpperCase() === savedIban);
        setSelectedBankProfileId(matchedProfile?.id ?? profiles[0]?.id ?? "");

        setTransportKm(data.transportKm ?? "");
        setTransportFuelPrice(data.transportFuelPrice ?? "10");
        setClientEmail(data.clientEmail ?? "");
        setClientName(data.clientName ?? "");
        setClientPhone(data.clientPhone ?? "");
        setClientAddress(data.clientAddress ?? "");
        setClientCity(data.clientCity ?? "");
        setClientCounty(data.clientCounty ?? "");
        setClientIdSeries(data.clientIdSeries ?? "");
        setNoAdvance(data.noAdvance === true);
        setPrivateClient(data.privateClient === true);
        setFiscalized(data.fiscalized === true);
        setLinkedEventId(data.eventId ?? null);

        const computedAuto =
          populated.filter((s) => s.included).reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0) +
          customSvcs.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0);
        setManualTotal(total !== computedAuto);
      })
      .catch((e: Error) => setPageError(e.message))
      .finally(() => setPageLoading(false));
  }, [id]);

  useEffect(() => {
    const km = parseFloat(transportKm);
    const fuel = parseFloat(transportFuelPrice);
    if (!isNaN(km) && km > 0 && !isNaN(fuel) && fuel > 0) {
      const estimated = Math.ceil(km * 6 / 100 * fuel).toString();
      setServices((prev) => prev.map((s) => s.id === TRANSPORT_SERVICE_ID ? { ...s, priceRaw: estimated } : s));
    }
  }, [transportKm, transportFuelPrice]);

  const selectedServices = services.filter((s) => s.included);
  const customTotal = customServices.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0);
  const autoTotal = selectedServices.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0) + customTotal;
  const effectiveTotal = manualTotal ? priceTotal : autoTotal;
  const priceRest = noAdvance ? effectiveTotal : Math.max(0, effectiveTotal - (priceAdvance || 0));

  const toggleService = (sid: string) => {
    setServices((prev) => prev.map((s) => s.id === sid ? { ...s, included: !s.included } : s));
    setServiceErrors((prev) => { const n = new Set(prev); n.delete(sid); return n; });
  };

  const setServicePriceRaw = (sid: string, raw: string) => {
    setServices((prev) => prev.map((s) => s.id === sid ? { ...s, priceRaw: raw } : s));
    setServiceErrors((prev) => { const n = new Set(prev); n.delete(sid); return n; });
  };

  const addCustomService = () => setCustomServices((prev) => [...prev, { label: "", priceRaw: "" }]);
  const removeCustomService = (i: number) => setCustomServices((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!eventType) { setSubmitError("Selectează tipul evenimentului."); return; }
    if (!eventDate) { setSubmitError("Data evenimentului este obligatorie."); return; }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      setSubmitError("Email-ul clientului este obligatoriu și trebuie să fie valid."); return;
    }

    const missing = new Set<string>();
    selectedServices.forEach((s) => { if (parsePrice(s.priceRaw) === "missing") missing.add(s.id); });
    customServices.forEach((s, i) => { if (s.label.trim() && parsePrice(s.priceRaw) === "missing") missing.add(`custom_${i}`); });
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
          ...(s.id === TRANSPORT_SERVICE_ID ? { isTransport: true } : {}),
        })),
        ...customServices.filter((s) => s.label.trim()).map((s) => ({
          label: s.label,
          price: priceToNumeric(s.priceRaw),
          gratuit: parsePrice(s.priceRaw) === "gratuit",
        })),
      ];

      const selectedBankProfile = bankProfiles.find((p) => p.id === selectedBankProfileId);
      const payload = {
        eventType, eventDate, eventLocation, eventStartTime, eventEndTime, eventDetails,
        services: allServices,
        currency, eurRate,
        priceTotal: effectiveTotal,
        noAdvance,
        priceAdvance: noAdvance ? 0 : (priceAdvance || 0),
        priceRest,
        advancePaidAt: noAdvance ? "" : advancePaidAt,
        restPaidAt, paymentMethod,
        bankBeneficiaryName: paymentMethod === BANK_TRANSFER ? (selectedBankProfile?.beneficiaryName ?? "") : "",
        bankIban: paymentMethod === BANK_TRANSFER ? (selectedBankProfile?.iban ?? "") : "",
        fiscalized,
        clientEmail, clientName, clientPhone, clientAddress, clientCity, clientCounty, clientIdSeries, privateClient,
        transportKm: transportKm || "",
        transportFuelPrice: transportFuelPrice || DEFAULT_TRANSPORT_FUEL_PRICE,
      };

      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Eroare la salvare");
      navigate("/admin/contracts");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  const otherCurrency = currency === "RON" ? "EUR" : "RON";

  if (pageLoading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <p className="text-neutral-500 text-sm">Se încarcă...</p>
    </div>
  );

  if (pageError) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-red-400 text-sm mb-4">{pageError}</p>
        <button onClick={() => navigate("/admin/contracts")} className="text-neutral-400 text-sm hover:text-white transition-colors">
          ← Înapoi la contracte
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <button type="button" onClick={() => navigate("/admin/contracts")}
            className="text-neutral-400 hover:text-white transition-colors text-sm">
            ← Înapoi
          </button>
          <div className="flex-1">
            <h1 className="text-white text-2xl font-light tracking-tight">Editează contract</h1>
            <p className="text-neutral-400 text-sm mt-0.5">Modificările se aplică imediat. Nu se poate edita după semnare.</p>
          </div>
          {linkedEventId && (
            <button
              type="button"
              onClick={() => navigate("/admin", { state: { scrollToEvent: linkedEventId } })}
              className="text-violet-400 hover:text-violet-300 text-sm transition-colors whitespace-nowrap"
            >
              → Vezi eveniment
            </button>
          )}
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
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inp} />
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
                <input type="number" min="1" step="0.05" value={eurRate}
                  onChange={(e) => setEurRate(parseFloat(e.target.value) || DEFAULT_EUR_RATE)}
                  className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 text-center focus:outline-none focus:border-emerald-500/50" />
                <span className="text-xs text-neutral-500">RON</span>
              </div>
              <span className="text-xs text-neutral-600 ml-auto">Prețurile sunt în {currency} · conversie în {otherCurrency}</span>
            </div>

            <div className="space-y-1">
              {services.map((s) => {
                const parsed = parsePrice(s.priceRaw);
                const isGratuit = parsed === "gratuit";
                const isMissing = serviceErrors.has(s.id);
                const conversion = typeof parsed === "number" && parsed > 0 ? convertAmount(parsed, currency, eurRate) : "";

                return (
                  <div key={s.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isMissing ? "bg-red-500/10" : ""}`}>
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input type="checkbox" checked={s.included} onChange={() => toggleService(s.id)} className="accent-emerald-500 shrink-0" />
                      <span className={`text-xs leading-tight ${s.included ? "text-neutral-200" : "text-neutral-500"}`}>{s.label}</span>
                    </label>
                    {s.included && s.id === TRANSPORT_SERVICE_ID ? (
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <input type="number" min="0" value={transportKm} onChange={(e) => setTransportKm(e.target.value)}
                          placeholder="km" className="w-16 rounded px-2 py-1 text-xs text-right bg-neutral-700 border border-neutral-600 text-neutral-100 placeholder-neutral-500 focus:outline-none" />
                        <span className="text-xs text-neutral-500">km ×</span>
                        <input type="number" min="0" step="0.1" value={transportFuelPrice}
                          onChange={(e) => setTransportFuelPrice(e.target.value)}
                          className="w-14 rounded px-2 py-1 text-xs text-right bg-neutral-700 border border-neutral-600 text-neutral-100 focus:outline-none" />
                        <span className="text-xs text-neutral-500">lei/L =</span>
                        <span className="text-xs text-amber-400 font-medium">~{s.priceRaw || "0"} {currency}</span>
                      </div>
                    ) : s.included && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conversion && <span className="text-xs text-neutral-600">{conversion}</span>}
                        <input type="text" value={s.priceRaw} onChange={(e) => setServicePriceRaw(s.id, e.target.value)}
                          placeholder="Preț / GRATUIT"
                          className={`w-28 rounded px-2 py-1 text-xs text-right focus:outline-none transition-colors ${
                            isMissing ? "bg-red-500/20 border border-red-500/50 text-red-300 placeholder-red-400/50"
                            : isGratuit ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-neutral-700 border border-neutral-600 text-neutral-100 placeholder-neutral-500"
                          }`} />
                        <span className="text-xs text-neutral-600">{currency}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {customServices.length > 0 && (
              <div className="space-y-2 mt-3">
                {customServices.map((s, i) => {
                  const parsed = parsePrice(s.priceRaw);
                  const isGratuit = parsed === "gratuit";
                  const isMissing = serviceErrors.has(`custom_${i}`);
                  const conversion = typeof parsed === "number" && parsed > 0 ? convertAmount(parsed, currency, eurRate) : "";
                  return (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={s.label}
                        onChange={(e) => setCustomServices((prev) => prev.map((cs, ci) => ci === i ? { ...cs, label: e.target.value } : cs))}
                        placeholder="Denumire serviciu" className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none" />
                      {conversion && <span className="text-xs text-neutral-600 shrink-0">{conversion}</span>}
                      <input type="text" value={s.priceRaw}
                        onChange={(e) => setCustomServices((prev) => prev.map((cs, ci) => ci === i ? { ...cs, priceRaw: e.target.value } : cs))}
                        placeholder="Preț / GRATUIT"
                        className={`w-28 rounded-lg px-3 py-2 text-sm text-right focus:outline-none transition-colors ${
                          isMissing ? "bg-red-500/20 border border-red-500/50 text-red-300"
                          : isGratuit ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                          : "bg-neutral-800 border border-neutral-700 text-neutral-100"
                        }`} />
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

          {/* PRICING */}
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
                <DecimalInput value={priceTotal} onChange={setPriceTotal} step={50} className={inp} placeholder="0" />
              ) : (
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 flex items-center justify-between">
                  <span>{autoTotal} {currency}</span>
                  <span className="text-neutral-500 text-xs">{convertAmount(autoTotal, currency, eurRate) || "(suma serviciilor)"}</span>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={noAdvance}
                onChange={(e) => { setNoAdvance(e.target.checked); if (e.target.checked) { setPriceAdvance(0); setAdvancePaidAt(""); } }}
                className="accent-sky-500 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-sky-400 group-hover:text-sky-300 transition-colors">
                Fără avans obligatoriu
                <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                  Plata integrală — contractul nu condiționează validitatea de un avans
                </span>
              </span>
            </label>

            {!noAdvance && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Avans ({currency})</Label>
                  <DecimalInput value={priceAdvance} onChange={setPriceAdvance} step={50} className={inp} placeholder="0" />
                </div>
                <div>
                  <Label>Scadență avans</Label>
                  <input type="date" value={advancePaidAt} onChange={(e) => setAdvancePaidAt(e.target.value)} className={inp} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-800 rounded-lg px-4 py-3 text-sm text-neutral-300 flex items-center justify-between">
                <span>{noAdvance ? "Total de plătit" : "Rest de plată"}</span>
                <span className="text-white font-semibold">{priceRest} {currency}</span>
              </div>
              <div>
                <Label>{noAdvance ? "Scadență plată" : "Scadență rest"}</Label>
                <input type="date" value={restPaidAt} onChange={(e) => setRestPaidAt(e.target.value)} className={inp} />
              </div>
            </div>

            <div>
              <Label>Metodă de plată</Label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={sel}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>

            {paymentMethod === BANK_TRANSFER && bankProfiles.length > 0 && (
              <div>
                <Label>Cont bancar pentru transfer</Label>
                <div className="space-y-2">
                  {bankProfiles.map((profile) => (
                    <label
                      key={profile.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedBankProfileId === profile.id
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-neutral-700 hover:border-neutral-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bankProfile"
                        value={profile.id}
                        checked={selectedBankProfileId === profile.id}
                        onChange={() => setSelectedBankProfileId(profile.id)}
                        className="accent-amber-500 mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-neutral-200 font-medium">{profile.label}</div>
                        {profile.beneficiaryName && (
                          <div className="text-xs text-neutral-500 mt-0.5">{profile.beneficiaryName}</div>
                        )}
                        {profile.iban && (
                          <div className="text-xs text-neutral-400 font-mono mt-0.5 tracking-wide">{profile.iban}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {paymentMethod === BANK_TRANSFER && bankProfiles.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <span className="text-amber-400 text-xs">
                  Nu ai configurat niciun cont bancar.{" "}
                  <a href="/admin/bank-details" className="underline hover:text-amber-300">
                    Adaugă un profil →
                  </a>
                </span>
              </div>
            )}
          </Block>

          {/* CLIENT */}
          <Block title="Date client">
            <div>
              <Label>Email client *</Label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@email.com" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nume complet</Label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                  placeholder="ex. Maria Ionescu" className={inp} />
              </div>
              <div>
                <Label>Telefon</Label>
                <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="07xx xxx xxx" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Adresă</Label>
                <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Str. Florilor nr. 1" className={inp} />
              </div>
              <div>
                <Label>Oraș</Label>
                <input type="text" value={clientCity} onChange={(e) => setClientCity(e.target.value)}
                  placeholder="Cluj-Napoca" className={inp} />
              </div>
              <div>
                <Label>Județ</Label>
                <input type="text" value={clientCounty} onChange={(e) => setClientCounty(e.target.value)}
                  placeholder="Cluj" className={inp} />
              </div>
              <div>
                <Label>Serie buletin</Label>
                <input type="text" value={clientIdSeries} onChange={(e) => setClientIdSeries(e.target.value.toUpperCase())}
                  placeholder="AB123456" className={inp} />
              </div>
            </div>
            <label className="flex items-center gap-3 mt-2 cursor-pointer group">
              <input type="checkbox" checked={privateClient} onChange={(e) => setPrivateClient(e.target.checked)}
                className="accent-amber-500 w-4 h-4 shrink-0" />
              <span className="text-sm text-amber-400 group-hover:text-amber-300 transition-colors">
                Clientul dorește pozele/video să fie private
                <span className="block text-xs text-neutral-500 font-normal mt-0.5">
                  Bifează dacă nu ai voie să postezi materialele pe social media / portofoliu
                </span>
              </span>
            </label>
          </Block>

          {/* Fiscal status */}
          <Block title="Fiscal">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Status fiscal</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {fiscalized ? "Factură emisă pentru acest contract." : "Nicio factură emisă încă."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiscalized((v) => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  fiscalized
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500"
                }`}
              >
                {fiscalized ? "✓ Fiscalizat" : "Nefiscalizat"}
              </button>
            </div>
          </Block>

          {submitError && <p className="text-red-400 text-sm text-center">{submitError}</p>}

          <div className="flex gap-3 pb-4">
            <button type="button" onClick={() => navigate("/admin/contracts")}
              className="flex-1 py-3 border border-neutral-700 text-neutral-400 rounded-xl text-sm hover:border-neutral-500 transition-colors">
              Anulează
            </button>
            <button type="submit" disabled={loading}
              className="flex-[2] py-3 bg-amber-500/20 text-amber-400 rounded-xl text-sm font-semibold hover:bg-amber-500/30 hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Se salvează..." : "Salvează modificările"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest">{title}</h3>
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{children}</div>
);

const inp = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50 transition-colors placeholder-neutral-600";
const sel = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50 transition-colors";

export default EditContractPage;
