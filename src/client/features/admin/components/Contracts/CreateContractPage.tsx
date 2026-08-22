import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { BankProfile } from "../../types";
import ClauseChecklistEditor, { type ClauseSnapshot } from "./ClauseChecklistEditor";

interface CreateContractState {
  eventId?: string;
  eventType?: string;
  eventDate?: string;
  eventLocation?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientFullName?: string;
}

interface ServiceEntry {
  id: string;
  label: string;
  included: boolean;
  priceRaw: string; // "500", "GRATUIT", or "" (not set)
}

const TRANSPORT_SERVICE_ID = "transport";

// Pre-filled prices
const DEFAULT_SERVICES: ServiceEntry[] = [
  { id: "foto_video", label: "Foto + Video (1 fotograf + 1 videograf)", included: false, priceRaw: "800"  },
  { id: "foto_video_1", label: "Foto + Video (1 persoană)",             included: false, priceRaw: "600"  },
  { id: "foto",       label: "1 persoană responsabilă de foto",          included: false, priceRaw: "500"  },
  { id: "video",      label: "1 persoană responsabilă de video",         included: false, priceRaw: "300"  },
  { id: "foto2",      label: "2 persoane responsabile de foto",          included: false, priceRaw: "1000" },
  { id: "video2",     label: "2 persoane responsabile de video",         included: false, priceRaw: "600"  },
  { id: "album100",   label: "Album 100 poze 10×15 cm",                  included: false, priceRaw: "40"   },
  { id: "usb",        label: "USB Stick cu toate materialele",            included: false, priceRaw: ""     },
  { id: "photobooth", label: "Fotocabină / Photo Booth",                 included: false, priceRaw: "250"  },
  { id: "videobooth", label: "Video Cabină 360 / VideoBooth",            included: false, priceRaw: "250"  },
  { id: "teaser",     label: "Teaser video (1–2 min)",                   included: false, priceRaw: ""     },
  { id: TRANSPORT_SERVICE_ID,  label: "Taxă transport spre și de la eveniment",   included: false, priceRaw: ""     },
];

export const EVENT_TYPES = [
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

// Which services are pre-selected when the admin picks an event type
const SERVICE_TEMPLATES: Record<string, string[]> = {
  "Nuntă":                ["foto_video", "album100", TRANSPORT_SERVICE_ID],
  "Cununie civilă":       ["foto", TRANSPORT_SERVICE_ID],
  "Botez":                ["foto_video", TRANSPORT_SERVICE_ID],
  "Logodnă":              ["foto", TRANSPORT_SERVICE_ID],
  "Majorat":              ["foto_video", "photobooth", TRANSPORT_SERVICE_ID],
  "Corporate":            ["foto_video", TRANSPORT_SERVICE_ID],
  "Fotocabină / VideoBooth": ["photobooth", "videobooth"],
  "Ședință foto":         ["foto"],
  "Înmormântare":         ["foto", TRANSPORT_SERVICE_ID],
  "Altul":                [],
};
const CURRENCIES = ["RON", "EUR"];
const DEFAULT_CURRENCY = "RON";
const BANK_TRANSFER = "Transfer bancar";
const CASH = "Cash";
const CARD = "Card";
const REVOLUT = "Revolut";
const PAYMENT_METHODS = [BANK_TRANSFER, CASH, CARD, REVOLUT];
const DEFAULT_EUR_RATE = 5;
const DEFAULT_TRANSPORT_FUEL_PRICE = "10";
const DRAFT_KEY = "contract-create-draft";

function parseDecimal(raw: string): number {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

function formatDecimal(value: number): string {
  if (value === 0) return "";
  return String(value).replace(".", ",");
}

function DecimalInput({
  value,
  onChange,
  step = 0.05,
  className,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  className?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = React.useState(formatDecimal(value));

  React.useEffect(() => {
    if (parseDecimal(raw) !== value) setRaw(formatDecimal(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setRaw(text);
    onChange(parseDecimal(text));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? step : -step;
      const next = Math.max(0, Math.round((value + delta) * 10000) / 10000);
      onChange(next);
      setRaw(formatDecimal(next));
    }
  }

  function handleBlur() {
    const num = parseDecimal(raw);
    setRaw(num === 0 ? "" : formatDecimal(num));
    onChange(num);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={className}
    />
  );
}

// Parses the value of a price field
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
  const [lastAppliedTemplate, setLastAppliedTemplate] = useState<string | null>(null);

  // Event
  const [eventType, setEventType] = useState(fromEvent.eventType ?? "");
  const [eventDate, setEventDate] = useState(fromEvent.eventDate ?? "");
  const [eventLocation, setEventLocation] = useState(fromEvent.eventLocation ?? "");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  // Services
  const [services, setServices] = useState<ServiceEntry[]>(DEFAULT_SERVICES);
  const [customServices, setCustomServices] = useState<{ label: string; priceRaw: string }[]>([]);

  // Exchange rate
  const [eurRate, setEurRate] = useState<number>(DEFAULT_EUR_RATE);
  const [eurRateDate, setEurRateDate] = useState<string | null>(null);
  const [eurRateLoading, setEurRateLoading] = useState(false);

  // Pricing
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [manualTotal, setManualTotal] = useState(false);
  const [priceTotal, setPriceTotal] = useState(0);
  const [noAdvance, setNoAdvance] = useState(false);
  const [priceAdvance, setPriceAdvance] = useState(0);
  const [advancePaidAt, setAdvancePaidAt] = useState("");
  const [restPaidAt, setRestPaidAt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(BANK_TRANSFER);

  // Bank profiles
  const [bankProfiles, setBankProfiles] = useState<BankProfile[]>([]);
  const [selectedBankProfileId, setSelectedBankProfileId] = useState("");

  // Transport
  const [transportKm, setTransportKm] = useState("");
  const [transportFuelPrice, setTransportFuelPrice] = useState(DEFAULT_TRANSPORT_FUEL_PRICE);

  // Client
  const [clientEmail, setClientEmail] = useState(fromEvent.clientEmail ?? "");
  const [clientName, setClientName] = useState(fromEvent.clientFullName ?? "");
  const [clientPhone, setClientPhone] = useState(fromEvent.clientPhone ?? "");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientCounty, setClientCounty] = useState("");
  const [clientIdSeries, setClientIdSeries] = useState("");
  const [clientType, setClientType] = useState<"PF" | "PJ">("PF");
  const [clientEntityType, setClientEntityType] = useState("Firma");
  const [clientCIF, setClientCIF] = useState("");
  const [clientRegistrationNumber, setClientRegistrationNumber] = useState("");
  const [clientBankName, setClientBankName] = useState("");
  const [clientIBAN, setClientIBAN] = useState("");
  const [clientRepresentativeName, setClientRepresentativeName] = useState("");
  const [clientRepresentativeRole, setClientRepresentativeRole] = useState("delegat");
  const [clientRepresentativeIdSeries, setClientRepresentativeIdSeries] = useState("");
  const [clientCNP, setClientCNP] = useState("");
  const [privateClient, setPrivateClient] = useState(false);

  // Calculated totals (GRATUIT = 0, missing = 0 but will be validated)
  const selectedServices = services.filter((s) => s.included);
  const customTotal = customServices.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0);
  const autoTotal = selectedServices.reduce((sum, s) => sum + priceToNumeric(s.priceRaw), 0) + customTotal;
  const effectiveTotal = manualTotal ? priceTotal : autoTotal;
  const priceRest = noAdvance ? effectiveTotal : Math.max(0, effectiveTotal - (priceAdvance || 0));

  const allServices = [
    ...selectedServices.map((s) => ({
      label: s.label,
      price: priceToNumeric(s.priceRaw),
      gratuit: parsePrice(s.priceRaw) === "gratuit",
      ...(s.id === TRANSPORT_SERVICE_ID ? { isTransport: true } : {}),
    })),
    ...customServices
      .filter((s) => s.label.trim())
      .map((s) => ({
        label: s.label,
        price: priceToNumeric(s.priceRaw),
        gratuit: parsePrice(s.priceRaw) === "gratuit",
      })),
  ];

  const [clauses, setClauses] = useState<ClauseSnapshot[]>([]);

  const [draftRestored, setDraftRestored] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.eventType !== undefined) setEventType(draft.eventType);
      if (draft.eventDate !== undefined) setEventDate(draft.eventDate);
      if (draft.eventLocation !== undefined) setEventLocation(draft.eventLocation);
      if (draft.eventStartTime !== undefined) setEventStartTime(draft.eventStartTime);
      if (draft.eventEndTime !== undefined) setEventEndTime(draft.eventEndTime);
      if (draft.eventDetails !== undefined) setEventDetails(draft.eventDetails);
      if (draft.services !== undefined) setServices(draft.services);
      if (draft.customServices !== undefined) setCustomServices(draft.customServices);
      if (draft.currency !== undefined) setCurrency(draft.currency);
      if (draft.manualTotal !== undefined) setManualTotal(draft.manualTotal);
      if (draft.priceTotal !== undefined) setPriceTotal(draft.priceTotal);
      if (draft.noAdvance !== undefined) setNoAdvance(draft.noAdvance);
      if (draft.priceAdvance !== undefined) setPriceAdvance(draft.priceAdvance);
      if (draft.advancePaidAt !== undefined) setAdvancePaidAt(draft.advancePaidAt);
      if (draft.restPaidAt !== undefined) setRestPaidAt(draft.restPaidAt);
      if (draft.paymentMethod !== undefined) setPaymentMethod(draft.paymentMethod);
      if (draft.transportKm !== undefined) setTransportKm(draft.transportKm);
      if (draft.transportFuelPrice !== undefined) setTransportFuelPrice(draft.transportFuelPrice);
      if (draft.clientEmail !== undefined) setClientEmail(draft.clientEmail);
      if (draft.clientName !== undefined) setClientName(draft.clientName);
      if (draft.clientPhone !== undefined) setClientPhone(draft.clientPhone);
      if (draft.clientAddress !== undefined) setClientAddress(draft.clientAddress);
      if (draft.clientIdSeries !== undefined) setClientIdSeries(draft.clientIdSeries);
      if (draft.clientType !== undefined) setClientType(draft.clientType);
      if (draft.clientEntityType !== undefined) setClientEntityType(draft.clientEntityType);
      if (draft.clientCIF !== undefined) setClientCIF(draft.clientCIF);
      if (draft.clientRegistrationNumber !== undefined) setClientRegistrationNumber(draft.clientRegistrationNumber);
      if (draft.clientBankName !== undefined) setClientBankName(draft.clientBankName);
      if (draft.clientIBAN !== undefined) setClientIBAN(draft.clientIBAN);
      if (draft.clientRepresentativeName !== undefined) setClientRepresentativeName(draft.clientRepresentativeName);
      if (draft.clientRepresentativeRole !== undefined) setClientRepresentativeRole(draft.clientRepresentativeRole);
      if (draft.clientRepresentativeIdSeries !== undefined) setClientRepresentativeIdSeries(draft.clientRepresentativeIdSeries);
      if (draft.privateClient !== undefined) setPrivateClient(draft.privateClient);
      if (draft.selectedBankProfileId !== undefined) setSelectedBankProfileId(draft.selectedBankProfileId);
      setDraftRestored(true);
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          eventType, eventDate, eventLocation, eventStartTime, eventEndTime, eventDetails,
          services, customServices,
          currency, manualTotal, priceTotal, noAdvance, priceAdvance, advancePaidAt, restPaidAt, paymentMethod,
          transportKm, transportFuelPrice,
          clientEmail, clientName, clientPhone, clientAddress, clientCity, clientCounty, clientIdSeries, clientType, clientEntityType, clientCIF,
          clientRegistrationNumber, clientBankName, clientIBAN, clientRepresentativeName, clientRepresentativeRole, clientRepresentativeIdSeries, clientCNP, privateClient,
          selectedBankProfileId,
        }));
      } catch { /* quota exceeded, ignore */ }
    }, 600);
    return () => clearTimeout(timer);
  }, [
    eventType, eventDate, eventLocation, eventStartTime, eventEndTime, eventDetails,
    services, customServices,
    currency, manualTotal, priceTotal, noAdvance, priceAdvance, advancePaidAt, restPaidAt, paymentMethod,
    transportKm, transportFuelPrice,
    clientEmail, clientName, clientPhone, clientAddress, clientCity, clientCounty, clientIdSeries, clientType, clientEntityType, clientCIF,
    clientRegistrationNumber, clientBankName, clientIBAN, clientRepresentativeName, clientRepresentativeRole, clientRepresentativeIdSeries, clientCNP, privateClient,
    selectedBankProfileId,
  ]);

  // Fetch live EUR/RON rate from Frankfurter (ECB data) on mount
  useEffect(() => {
    setEurRateLoading(true);
    fetch("https://api.frankfurter.app/latest?from=EUR&to=RON")
      .then((response) => response.json())
      .then((data) => {
        const rate = data?.rates?.RON;
        if (rate && typeof rate === "number") {
          setEurRate(parseFloat(rate.toFixed(4)));
          setEurRateDate(data.date ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setEurRateLoading(false));
  }, []);

  // Fetch bank profiles from settings
  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(data => {
        if (data.error) return;
        let profiles: BankProfile[] = Array.isArray(data.bankProfiles) ? data.bankProfiles : [];
        if (profiles.length === 0 && (data.bankDetails?.beneficiaryName || data.bankDetails?.iban)) {
          profiles = [{
            id: "legacy",
            label: "Cont principal",
            beneficiaryName: data.bankDetails.beneficiaryName ?? "",
            iban: data.bankDetails.iban ?? "",
          }];
        }
        setBankProfiles(profiles);
        setSelectedBankProfileId(prev => {
          if (prev) return prev;
          return profiles[0]?.id ?? "";
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-update transport price when km / fuel price changes
  useEffect(() => {
    const km = parseFloat(transportKm);
    const fuel = parseFloat(transportFuelPrice);
    if (!isNaN(km) && km > 0 && !isNaN(fuel) && fuel > 0) {
      const estimated = Math.ceil(km * 6 / 100 * fuel).toString();
      setServices((prev) => prev.map((s) => s.id === TRANSPORT_SERVICE_ID ? { ...s, priceRaw: estimated } : s));
    }
  }, [transportKm, transportFuelPrice]);

  const applyTemplate = (type: string) => {
    const templateIds = SERVICE_TEMPLATES[type] ?? [];
    setServices((prev) => prev.map((s) => ({ ...s, included: templateIds.includes(s.id) })));
    setLastAppliedTemplate(type);
    setServiceErrors(new Set());
  };

  const handleEventTypeChange = (type: string) => {
    setEventType(type);
    if (type && SERVICE_TEMPLATES[type] !== undefined) {
      applyTemplate(type);
    }
  };

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

    // Validate prices for checked services — must be filled in or GRATUIT
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
      const selectedBankProfile = bankProfiles.find(p => p.id === selectedBankProfileId);
      const payload = {
        eventType, eventDate, eventLocation, eventStartTime, eventEndTime, eventDetails,
        services: allServices,
        currency,
        eurRate,
        priceTotal: effectiveTotal,
        noAdvance,
        priceAdvance: noAdvance ? 0 : (priceAdvance || 0),
        priceRest,
        advancePaidAt: noAdvance ? "" : advancePaidAt,
        restPaidAt,
        paymentMethod,
        bankBeneficiaryName: paymentMethod === BANK_TRANSFER ? (selectedBankProfile?.beneficiaryName ?? "") : "",
        bankIban: paymentMethod === BANK_TRANSFER ? (selectedBankProfile?.iban ?? "") : "",
        clientEmail,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientAddress: clientAddress.trim(),
        clientCity: clientCity.trim(),
        clientCounty: clientCounty.trim(),
        clientIdSeries: clientIdSeries.trim(),
        ...(clientType === "PJ" ? {
          clientType,
          clientEntityType: clientEntityType.trim(),
          clientCIF: clientCIF.trim().toUpperCase(),
          clientRegistrationNumber: clientRegistrationNumber.trim(),
          clientBankName: clientBankName.trim(),
          clientIBAN: clientIBAN.trim().toUpperCase(),
          clientRepresentativeName: clientRepresentativeName.trim(),
          clientRepresentativeRole: clientRepresentativeRole.trim(),
          clientRepresentativeIdSeries: clientRepresentativeIdSeries.trim().toUpperCase(),
        } : {}),
        privateClient,
        transportKm: transportKm || "",
        transportFuelPrice: transportFuelPrice || DEFAULT_TRANSPORT_FUEL_PRICE,
        clauses,
        ...(fromEvent.eventId ? { eventId: fromEvent.eventId } : {}),
      };

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Eroare la creare");
      localStorage.removeItem(DRAFT_KEY);
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

        {draftRestored && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-2.5">
            <p className="text-sky-300 text-sm">Draft recuperat — continuă de unde ai rămas.</p>
            <button onClick={() => { localStorage.removeItem(DRAFT_KEY); window.location.reload(); }}
              className="text-xs text-sky-400/60 hover:text-sky-300 shrink-0">Șterge draft</button>
          </div>
        )}

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
                <select value={eventType} onChange={(e) => handleEventTypeChange(e.target.value)} className={sel}>
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
            {eventStartTime && eventEndTime && eventEndTime <= eventStartTime && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <span className="text-amber-400 text-xs">
                  Intervalul indică un eveniment ce se prelungește după miezul nopții (00:00). Contractul va menționa explicit acest lucru — ora de sfârșit aparține zilei următoare.
                </span>
              </div>
            )}
            <div>
              <Label>Mențiuni suplimentare</Label>
              <textarea value={eventDetails} onChange={(e) => setEventDetails(e.target.value)}
                rows={2} placeholder="Orice detalii relevante..." className={inp} />
            </div>
          </Block>

          {/* SERVICII */}
          <Block title="Servicii incluse">

            {/* Template notice */}
            {lastAppliedTemplate && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
                <span className="text-xs text-emerald-400">
                  Template aplicat: <span className="font-semibold">{lastAppliedTemplate}</span>
                  {" "}— serviciile au fost pre-selectate automat. Poți ajusta mai jos.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setServices(DEFAULT_SERVICES.map((s) => ({ ...s, included: false })));
                    setLastAppliedTemplate(null);
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-300 ml-3 shrink-0 transition-colors"
                >
                  Resetează
                </button>
              </div>
            )}

            {/* Exchange rate + currency — above the checkboxes */}
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
                  step="0.05"
                  value={eurRate}
                  onChange={(e) => { setEurRate(parseFloat(e.target.value) || DEFAULT_EUR_RATE); setEurRateDate(null); }}
                  className="w-24 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-100 text-center focus:outline-none focus:border-emerald-500/50"
                />
                <span className="text-xs text-neutral-500">RON</span>
                {eurRateLoading && (
                  <span className="text-xs text-neutral-600 animate-pulse">se încarcă...</span>
                )}
                {eurRateDate && !eurRateLoading && (
                  <span className="text-xs text-emerald-500/70">BCE {eurRateDate}</span>
                )}
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

                    {s.included && s.id === TRANSPORT_SERVICE_ID ? (
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
                  <span className="text-neutral-500 text-xs">
                    {convertAmount(autoTotal, currency, eurRate) || "(suma serviciilor)"}
                  </span>
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
                  {bankProfiles.map(profile => (
                    <label
                      key={profile.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedBankProfileId === profile.id
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-neutral-700 hover:border-neutral-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bankProfile"
                        value={profile.id}
                        checked={selectedBankProfileId === profile.id}
                        onChange={() => setSelectedBankProfileId(profile.id)}
                        className="accent-emerald-500 mt-0.5 shrink-0"
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

            {/* Payment overview */}
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
                  {noAdvance ? (
                    <div className="flex items-center justify-between px-4 py-3 bg-sky-500/5">
                      <div>
                        <div className="text-neutral-200">Plată integrală <span className="text-sky-400 font-medium">(fără avans)</span></div>
                        {restPaidAt && <div className="text-xs text-neutral-500 mt-0.5">Scadentă: {restPaidAt}</div>}
                      </div>
                      <div className="text-sky-400 font-semibold">{effectiveTotal} {currency}</div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            )}
          </Block>

          {/* CLIENT */}
          <Block title="Date client">
            <div>
              <Label>Tip beneficiar</Label>
              <select value={clientType} onChange={(e) => setClientType(e.target.value as "PF" | "PJ")} className={sel}>
                <option value="PF">Persoană fizică</option>
                <option value="PJ">Firmă / Asociație / persoană juridică</option>
              </select>
            </div>
            <div>
              <Label>Email client *</Label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@email.com" className={inp} />
              <span className="text-neutral-500 text-xs mt-1 block">
                Link-ul de semnare va fi trimis la această adresă.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{clientType === "PJ" ? "Denumire firmă / asociație" : "Nume și prenume"}</Label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                  placeholder={clientType === "PJ" ? "Ex. ASOCIAȚIA PENTRU DEZVOLTARE ACTIVĂ (ADA)" : "Ion Popescu"} className={inp} />
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
                  placeholder={clientType === "PJ" ? "Sediul social: stradă, număr, bloc, scară, apartament" : "Str. Exemplu nr. 1"} className={inp} />
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
              {clientType === "PF" && <div>
                <Label>Serie buletin</Label>
                <input type="text" value={clientIdSeries} onChange={(e) => setClientIdSeries(e.target.value.toUpperCase())}
                  placeholder="AB123456" className={inp} />
              </div>}
            </div>

            {clientType === "PJ" && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <p className="text-amber-300 text-sm font-medium">Date persoană juridică</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tip entitate</Label>
                    <select value={clientEntityType} onChange={(e) => setClientEntityType(e.target.value)} className={sel}>
                      <option>Firmă</option><option>Asociație</option><option>Altă persoană juridică</option>
                    </select>
                  </div>
                  <div>
                    <Label>CIF / CUI</Label>
                    <input type="text" value={clientCIF} onChange={(e) => setClientCIF(e.target.value.toUpperCase())} placeholder="30085947" className={inp} />
                  </div>
                </div>
                <div>
                  <Label>Nr. registru / înregistrare (opțional)</Label>
                  <input type="text" value={clientRegistrationNumber} onChange={(e) => setClientRegistrationNumber(e.target.value)} placeholder="Ex. J04/123/2020 sau nr. registru asociații" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nume delegat / reprezentant</Label>
                    <input type="text" value={clientRepresentativeName} onChange={(e) => setClientRepresentativeName(e.target.value)} placeholder="Toma Victor-Cătălin" className={inp} />
                  </div>
                  <div>
                    <Label>Calitate</Label>
                    <input type="text" value={clientRepresentativeRole} onChange={(e) => setClientRepresentativeRole(e.target.value)} placeholder="delegat / președinte / administrator" className={inp} />
                  </div>
                </div>
                <div>
                  <Label>CI delegat / reprezentant</Label>
                  <input type="text" value={clientRepresentativeIdSeries} onChange={(e) => setClientRepresentativeIdSeries(e.target.value.toUpperCase())} placeholder="AB123456" className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Banca (opțional)</Label><input type="text" value={clientBankName} onChange={(e) => setClientBankName(e.target.value)} placeholder="Raiffeisen Bank" className={inp} /></div>
                  <div><Label>IBAN (opțional)</Label><input type="text" value={clientIBAN} onChange={(e) => setClientIBAN(e.target.value.toUpperCase())} placeholder="RO..." className={inp} /></div>
                </div>
                <p className="text-xs text-neutral-500">Contractul și factura vor fi emise pe entitate. Persoana de mai sus doar semnează în numele ei.</p>
              </div>
            )}

            <p className="text-neutral-600 text-xs">
              Câmpurile de mai sus sunt opționale — clientul le va vedea pre-completate și poate corecta înainte de a semna.
            </p>

            <label className="flex items-center gap-3 cursor-pointer group">
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

          <Block title="Clauze contract">
            <ClauseChecklistEditor
              eventType={eventType}
              services={allServices}
              privateClient={privateClient}
              eventDate={eventDate}
              eventStartTime={eventStartTime}
              eventEndTime={eventEndTime}
              eventLocation={eventLocation}
              clientName={clientName}
              priceTotal={effectiveTotal}
              currency={currency}
              priceAdvance={noAdvance ? 0 : priceAdvance}
              priceRest={priceRest}
              bankBeneficiaryName={paymentMethod === BANK_TRANSFER ? (bankProfiles.find(p => p.id === selectedBankProfileId)?.beneficiaryName ?? "") : ""}
              bankIban={paymentMethod === BANK_TRANSFER ? (bankProfiles.find(p => p.id === selectedBankProfileId)?.iban ?? "") : ""}
              transportKm={transportKm}
              transportFuelPrice={transportFuelPrice}
              value={clauses}
              onChange={setClauses}
            />
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
