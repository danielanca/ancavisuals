import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";

interface EventSummary {
  id: string;
  clientName: string | null;
  type: string | null;
  eventDate: string | null;
  albumSlug: string | null;
  photoboothCount: number;
  qrGuestCount: number;
  totalContacts: number;
}

interface PhotoboothGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notified: boolean;
  timestamp: string | null;
  source: "fotocabina";
}

interface QRGuest {
  id: string;
  name: string;
  email: string;
  emailConsent: boolean;
  uploadCount: number;
  timestamp: string | null;
  source: "qr-moments";
}

interface EventDetail {
  event: {
    id: string;
    clientName: string | null;
    type: string | null;
    eventDate: string | null;
    albumSlug: string | null;
    qrEventSlug: string | null;
  };
  photoboothGuests: PhotoboothGuest[];
  qrGuests: QRGuest[];
}

type FilterSource = "all" | "fotocabina" | "qr-moments";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const SOURCE_COLORS: Record<"fotocabina" | "qr-moments", string> = {
  "fotocabina": "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "qr-moments": "bg-amber-500/15 text-amber-300 border-amber-500/25",
};

export default function ContactsAdminPage() {
  const { auth } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter] = useState<FilterSource>("all");

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/contacts", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: { events: EventSummary[] }) => setEvents(data.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  useEffect(() => {
    if (!selectedEventId || !auth.accessToken) return;
    setDetailLoading(true);
    setDetail(null);
    fetch(`/api/admin/contacts/${selectedEventId}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: EventDetail) => setDetail(data))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedEventId, auth.accessToken]);

  const allContacts = detail
    ? [
        ...detail.photoboothGuests,
        ...detail.qrGuests,
      ].sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
    : [];

  const filtered = filter === "all"
    ? allContacts
    : allContacts.filter((contact) => contact.source === filter);

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Contacte</h1>
          <p className="text-neutral-500 text-sm mt-0.5">Invitați înregistrați prin Fotocabina și QR Moments</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="animate-spin text-neutral-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </div>
        ) : events.length === 0 ? (
          <p className="text-neutral-500 text-sm py-8 text-center">Niciun contact înregistrat încă.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Event list */}
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-3">Selectează evenimentul</p>
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedEventId === event.id
                      ? "bg-neutral-800 border-neutral-600"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <p className="text-sm font-medium text-white truncate">{event.clientName ?? event.albumSlug ?? event.id}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{formatDate(event.eventDate)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {event.photoboothCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-purple-500/15 text-purple-300 border-purple-500/25">
                        Fotocabina {event.photoboothCount}
                      </span>
                    )}
                    {event.qrGuestCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/25">
                        QR {event.qrGuestCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Detail panel */}
            <div>
              {!selectedEventId && (
                <div className="flex items-center justify-center h-full min-h-[200px] text-neutral-600 text-sm">
                  Selectează un eveniment din stânga
                </div>
              )}

              {selectedEventId && detailLoading && (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin text-neutral-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                </div>
              )}

              {detail && !detailLoading && (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{detail.event.clientName ?? detail.event.albumSlug ?? detail.event.id}</p>
                      <p className="text-neutral-500 text-xs">{formatDate(detail.event.eventDate)} · {allContacts.length} contacte total</p>
                    </div>
                    {detail.event.albumSlug && (
                      <a
                        href={`/fotocabina/${detail.event.albumSlug}/galerie`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
                      >
                        Galerie foto →
                      </a>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900 p-1 gap-1">
                    {(["all", "fotocabina", "qr-moments"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          filter === tab ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-neutral-300"
                        }`}
                      >
                        {tab === "all" ? `Toate (${allContacts.length})` : tab === "fotocabina" ? `Fotocabina (${detail.photoboothGuests.length})` : `QR Moments (${detail.qrGuests.length})`}
                      </button>
                    ))}
                  </div>

                  {/* Contact rows */}
                  {filtered.length === 0 ? (
                    <p className="text-neutral-600 text-sm py-4 text-center">Niciun contact în această categorie.</p>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((contact) => (
                        <div key={contact.id} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-medium shrink-0 mt-0.5">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-white">{contact.name}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SOURCE_COLORS[contact.source]}`}>
                                {contact.source === "fotocabina" ? "Fotocabina" : "QR Moments"}
                              </span>
                              {contact.source === "fotocabina" && (contact as PhotoboothGuest).notified && (
                                <span className="text-[10px] text-emerald-400">✓ notificat</span>
                              )}
                              {contact.source === "qr-moments" && (
                                <span className="text-[10px] text-neutral-500">{(contact as QRGuest).uploadCount} upload{(contact as QRGuest).uploadCount !== 1 ? "uri" : ""}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {contact.email && (
                                <a href={`mailto:${contact.email}`} className="text-xs text-neutral-400 hover:text-amber-300 transition-colors truncate">
                                  {contact.email}
                                </a>
                              )}
                              {contact.source === "fotocabina" && (contact as PhotoboothGuest).phone && (
                                <a href={`tel:${(contact as PhotoboothGuest).phone}`} className="text-xs text-neutral-400 hover:text-white transition-colors">
                                  {(contact as PhotoboothGuest).phone}
                                </a>
                              )}
                              <span className="text-[11px] text-neutral-600">{formatTime(contact.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
