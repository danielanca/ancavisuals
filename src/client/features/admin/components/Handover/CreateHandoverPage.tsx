import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface CreateHandoverState {
  eventId?: string;
  eventType?: string;
  eventDate?: string;
  clientEmail?: string;
  clientFullName?: string;
}

interface AdminEvent {
  id: string;
  type: string;
  typeLabel?: string;
  eventDate?: string;
  albumSlug?: string;
  client?: { fullName?: string; email?: string; phone?: string };
}

const DEFAULT_COURIER_DELIVERY_DAYS = 7;
const DEFAULT_MATERIALS_REPORT_WINDOW_DAYS = 7;
const DEFAULT_DIGITAL_LINK_EXPIRY_DAYS = 30;

const CreateHandoverPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromEvent = (location.state as CreateHandoverState | null) ?? {};

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventQuery, setEventQuery] = useState("");
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);

  const [eventType, setEventType] = useState(fromEvent.eventType ?? "");
  const [eventDate, setEventDate] = useState(fromEvent.eventDate ?? "");
  const [eventId, setEventId] = useState(fromEvent.eventId ?? "");

  const [clientName, setClientName] = useState(fromEvent.clientFullName ?? "");
  const [clientEmail, setClientEmail] = useState(fromEvent.clientEmail ?? "");

  const [includeDigitalLink, setIncludeDigitalLink] = useState(true);
  const [includeCourier, setIncludeCourier] = useState(true);
  const [includePersonalHandover, setIncludePersonalHandover] = useState(false);

  const [digitalLinkUrl, setDigitalLinkUrl] = useState("");
  const [awb, setAwb] = useState("");
  const [courierDeliveryDays, setCourierDeliveryDays] = useState(DEFAULT_COURIER_DELIVERY_DAYS);
  const [materialsReportWindowDays, setMaterialsReportWindowDays] = useState(DEFAULT_MATERIALS_REPORT_WINDOW_DAYS);
  const [digitalLinkExpiryDays, setDigitalLinkExpiryDays] = useState(DEFAULT_DIGITAL_LINK_EXPIRY_DAYS);

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {});
  }, []);

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return events.slice(0, 20);
    return events.filter((e) => {
      const label = `${e.client?.fullName ?? ""} ${e.typeLabel ?? e.type} ${e.eventDate ?? ""}`.toLowerCase();
      return label.includes(q);
    }).slice(0, 20);
  }, [events, eventQuery]);

  const selectEvent = (event: AdminEvent) => {
    setSelectedEvent(event);
    setEventId(event.id);
    setEventType(event.typeLabel ?? event.type);
    setEventDate(event.eventDate ? event.eventDate.slice(0, 10) : "");
    setClientName(event.client?.fullName ?? "");
    setClientEmail(event.client?.email ?? "");
    if (event.albumSlug) {
      setDigitalLinkUrl(`${window.location.origin}/qr-moments/${event.albumSlug}`);
    }
    setEventQuery("");
    setEventPickerOpen(false);
  };

  const fmtDate = (s: string) => {
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!eventType.trim() || !eventDate.trim() || !clientEmail.trim()) {
      setSubmitError("Selectează un eveniment și completează emailul clientului.");
      return;
    }
    if (!includeDigitalLink && !includeCourier && !includePersonalHandover) {
      setSubmitError("Selectează cel puțin o metodă de predare a materialelor.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventId || undefined,
          eventType: eventType.trim(),
          eventDate: eventDate.trim(),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          includeDigitalLink,
          includeCourier,
          includePersonalHandover,
          digitalLinkUrl: digitalLinkUrl.trim(),
          awb: awb.trim(),
          courierDeliveryDays,
          materialsReportWindowDays,
          digitalLinkExpiryDays,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Eroare la creare");
      navigate("/admin/handover");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button type="button" onClick={() => navigate("/admin/handover")}
            className="text-neutral-400 hover:text-white transition-colors text-sm">
            ← Înapoi
          </button>
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Proces Verbal nou</h1>
            <p className="text-neutral-400 text-sm mt-0.5">
              {fromEvent.eventId
                ? <span className="text-emerald-400">Pre-completat din eveniment ↗</span>
                : "Selectează evenimentul — clientul va semna prin link"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <Block title="Eveniment">
            <div className="relative">
              <Label>Caută eveniment (nume client, tip, dată)</Label>
              <input
                className={inp}
                type="text"
                value={eventQuery}
                onChange={(e) => { setEventQuery(e.target.value); setEventPickerOpen(true); }}
                onFocus={() => setEventPickerOpen(true)}
                placeholder="Ex: Popescu, Nuntă, 2026-08-..."
              />
              {eventPickerOpen && filteredEvents.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl">
                  {filteredEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => selectEvent(ev)}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
                    >
                      <span className="font-medium">{ev.client?.fullName || "Fără nume"}</span>
                      <span className="text-neutral-400"> — {ev.typeLabel ?? ev.type} — {fmtDate(ev.eventDate ?? "")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedEvent && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm text-emerald-300">
                {selectedEvent.client?.fullName} — {selectedEvent.typeLabel ?? selectedEvent.type} — {fmtDate(selectedEvent.eventDate ?? "")}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tip eveniment</Label>
                <input className={inp} type="text" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Ex: Nuntă" />
              </div>
              <div>
                <Label>Data evenimentului</Label>
                <input className={inp} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
            </div>
          </Block>

          <Block title="Client">
            <div>
              <Label>Nume client</Label>
              <input className={inp} type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: Popescu Ion" />
            </div>
            <div>
              <Label>Email client *</Label>
              <input className={inp} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Ex: maria@email.com" />
            </div>
          </Block>

          <Block title="Metodă de predare">
            <div className="space-y-2.5">
              <CheckboxRow id="includeDigitalLink" checked={includeDigitalLink} onChange={setIncludeDigitalLink}
                label="Trimitere link digital" hint="Link către galerie / QR Moments, trimis pe email după semnare." />
              <CheckboxRow id="includeCourier" checked={includeCourier} onChange={setIncludeCourier}
                label="Trimitere prin curier" hint="Materiale fizice (album etc.) expediate prin curier, cu AWB." />
              <CheckboxRow id="includePersonalHandover" checked={includePersonalHandover} onChange={setIncludePersonalHandover}
                label="Predare personală" hint="Materialele fizice sunt predate direct clientului, la data semnării." />
            </div>

            {includeDigitalLink && (
              <div>
                <Label>Link digital (galerie / QR Moments)</Label>
                <input className={inp} type="text" value={digitalLinkUrl} onChange={(e) => setDigitalLinkUrl(e.target.value)} placeholder="https://ancavisuals.ro/qr-moments/..." />
                <p className="text-neutral-500 text-xs mt-1.5">Clientul NU vede acest link înainte de semnare — îi va fi trimis pe email imediat după ce semnează.</p>
              </div>
            )}

            {includeCourier && (
              <div>
                <Label>AWB colet (opțional)</Label>
                <input className={inp} type="text" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="Ex: 1234567890 — completează doar dacă ai deja numărul de tracking" />
                <p className="text-neutral-500 text-xs mt-1.5">Dacă e completat, clientul e informat în PV să urmărească livrarea coletului cu acest AWB. Poți adăuga AWB-ul și mai târziu, din listă.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {includeCourier && (
                <div>
                  <Label>Livrare curier (zile)</Label>
                  <input className={inp} type="number" min={1} value={courierDeliveryDays}
                    onChange={(e) => setCourierDeliveryDays(Number(e.target.value) || DEFAULT_COURIER_DELIVERY_DAYS)} />
                </div>
              )}
              {(includeCourier || includePersonalHandover) && (
                <div>
                  <Label>Verificare integritate (zile)</Label>
                  <input className={inp} type="number" min={1} value={materialsReportWindowDays}
                    onChange={(e) => setMaterialsReportWindowDays(Number(e.target.value) || DEFAULT_MATERIALS_REPORT_WINDOW_DAYS)} />
                </div>
              )}
              {includeDigitalLink && (
                <div>
                  <Label>Valabilitate link digital (zile)</Label>
                  <input className={inp} type="number" min={1} value={digitalLinkExpiryDays}
                    onChange={(e) => setDigitalLinkExpiryDays(Number(e.target.value) || DEFAULT_DIGITAL_LINK_EXPIRY_DAYS)} />
                </div>
              )}
            </div>
          </Block>

          {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate("/admin/handover")}
              className="flex-1 py-3 bg-neutral-800 text-neutral-300 rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
              Anulează
            </button>
            <button type="submit" disabled={loading}
              className="flex-[2] py-3 bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/30 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Se salvează..." : "Salvează procesul verbal"}
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

const CheckboxRow: React.FC<{ id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }> = ({ id, checked, onChange, label, hint }) => (
  <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer">
    <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 w-4 h-4 accent-emerald-500 cursor-pointer flex-shrink-0" />
    <span>
      <span className="block text-sm text-neutral-200">{label}</span>
      <span className="block text-xs text-neutral-500">{hint}</span>
    </span>
  </label>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{children}</div>
);

const inp = "w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-neutral-600";

export default CreateHandoverPage;
