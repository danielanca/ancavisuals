import React, { useState, useEffect } from "react";
import useAuth from "../auth/useAuth";

interface Venue {
  placeId: string;
  slug: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  phone: string | null;
  website: string | null;
  types: string[];
}

interface LogEntry {
  id: string;
  placeId: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  website: string | null;
  channel: "whatsapp" | "email" | "sms";
  sentAt: string;
}

const CITIES = [
  // Cluj county
  "Cluj-Napoca", "Turda", "Dej", "Gherla", "Huedin", "Câmpia Turzii", "Câmpeni",
  // Alba county
  "Alba Iulia", "Blaj", "Sebeș", "Aiud", "Cugir", "Abrud", "Ocna Mureș", "Teiuș",
  // Sibiu county
  "Sibiu", "Mediaș", "Cisnădie", "Avrig", "Agnita", "Dumbrăveni", "Miercurea Sibiului",
  // Brașov county
  "Brașov", "Codlea", "Zărnești", "Predeal", "Sinaia", "Făgăraș", "Rupea",
  // Mureș county
  "Târgu Mureș", "Reghin", "Sighișoara", "Sovata", "Luduș", "Târgu Lăpuș",
  // Bistrița-Năsăud county
  "Bistrița", "Beclean", "Năsăud", "Sângeorz-Băi",
  // Harghita county
  "Miercurea Ciuc", "Odorheiu Secuiesc", "Gheorgheni", "Toplița", "Cristuru Secuiesc",
  // Covasna county
  "Sfântu Gheorghe", "Târgu Secuiesc",
  // Hunedoara county
  "Deva", "Hunedoara", "Petroșani", "Orăștie", "Brad",
  // Bihor (Oradea area)
  "Oradea", "Salonta", "Beiuș", "Marghita", "Aleșd",
  // Arad county
  "Arad", "Lipova", "Ineu", "Sebiș", "Curtici",
  // Timiș county
  "Timișoara", "Lugoj",
  // Satu Mare county
  "Satu Mare", "Carei",
  // Maramureș county
  "Baia Mare", "Sighetu Marmației", "Vișeu de Sus",
  // Sălaj county
  "Zalău", "Șimleu Silvaniei",
];

const MESSAGE_TEMPLATES = {
  whatsapp: (venueName: string) =>
    `Bună ziua! 👋\n\nSuntem AncaVisuals, o echipă foto-video specializată în nunți, botezuri și majorate.\n\nAm admirat locația dumneavoastră — ${venueName} — și ne-am dori să discutăm o posibilă colaborare.\n\nMulți dintre clienții care rezervă la dumneavoastră caută și un fotograf/cameraman. Am putea fi recomandați reciproc.\n\nPortofoliul nostru: ancavisuals.ro\n\nVă mulțumim!`,
  email: (venueName: string) =>
    `Bună ziua,\n\nSuntem echipa AncaVisuals, specializați în fotografie și videografie pentru nunți, botezuri și majorate.\n\nAm observat că ${venueName} este o locație apreciată pentru evenimente speciale și ne-am dori să explorăm o posibilă colaborare de recomandare reciprocă.\n\nClienții dumneavoastră care organizează nunți sau botezuri au nevoie și de servicii foto-video profesionale. Am fi bucuroși să fim recomandați și, la rândul nostru, să vă promovăm locația clienților noștri.\n\nPortofoliu complet: ancavisuals.ro\n\nSuntem disponibili pentru o discuție oricând.\n\nCu stimă,\nEchipa AncaVisuals`,
  emailSubject: (venueName: string) => `Propunere colaborare foto-video — AncaVisuals & ${venueName}`,
  sms: () =>
    `Bună! Suntem AncaVisuals, echipă foto-video pentru nunți și evenimente. Dorim colaborare cu locații de evenimente. Portofoliu: ancavisuals.ro`,
};

type Tab = "search" | "contacted";
type ChannelFilter = "all" | "whatsapp" | "email" | "sms";
type ChannelToggle = Set<"whatsapp" | "email" | "sms">;

export default function VenueOutreachPage() {
  const { auth } = useAuth();
  const authHeader = { Authorization: `Bearer ${auth.accessToken}` };

  const [tab, setTab] = useState<Tab>("search");
  const [city, setCity] = useState("Cluj-Napoca");
  const [customCity, setCustomCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTemplate, setActiveTemplate] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [customMessage, setCustomMessage] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(false);

  const [visibleChannels, setVisibleChannels] = useState<ChannelToggle>(new Set(["whatsapp", "email", "sms"]));
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [venueEmails, setVenueEmails] = useState<Record<string, string>>({});

  // Persistent log
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  const effectiveCity = customCity.trim() || city;

  useEffect(() => {
    if (!auth.accessToken) return;
    setLogLoading(true);
    fetch("/api/admin/venue-outreach/log", { headers: authHeader })
      .then((response) => response.json())
      .then((data: { entries?: LogEntry[] }) => {
        const entries = data.entries ?? [];
        setLogEntries(entries);
        setContactedIds(new Set(entries.map((entry) => entry.placeId)));
      })
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, [auth.accessToken]);

  const saveToLog = async (venue: Venue, channel: "whatsapp" | "email" | "sms") => {
    try {
      await fetch("/api/admin/venue-outreach/log", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: venue.placeId,
          name: venue.name,
          city: effectiveCity,
          address: venue.address,
          phone: venue.phone,
          website: venue.website,
          channel,
        }),
      });
      const newEntry: LogEntry = {
        id: Date.now().toString(),
        placeId: venue.placeId,
        name: venue.name,
        city: effectiveCity,
        address: venue.address,
        phone: venue.phone,
        website: venue.website,
        channel,
        sentAt: new Date().toISOString(),
      };
      setLogEntries((prev) => [newEntry, ...prev]);
      setContactedIds((prev) => new Set([...prev, venue.placeId]));
    } catch {
      // log save failure is non-blocking
    }
  };

  const loadTestVenue = () => {
    setVenues([{
      placeId: "test-daniel",
      slug: "test-daniel",
      name: "TEST — Daniel",
      address: "Cluj-Napoca, România",
      rating: 5,
      reviewCount: 1,
      phone: "0745469907",
      website: "https://ancavisuals.ro",
      types: ["test"],
    }]);
    setSelected(new Set());
    setVenueEmails({});
  };

  const search = async () => {
    setLoading(true);
    setError(null);
    setVenues([]);
    setSelected(new Set());
    setVenueEmails({});
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) {
        params.set("keyword", keyword.trim());
        if (effectiveCity) params.set("city", effectiveCity);
      } else {
        params.set("city", effectiveCity);
      }
      const response = await fetch(`/api/admin/venue-outreach/search?${params.toString()}`, { headers: authHeader });
      const data = (await response.json()) as { venues?: Venue[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Eroare necunoscută");
      setVenues(data.venues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la căutare");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (placeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === venues.length) setSelected(new Set());
    else setSelected(new Set(venues.map((venue) => venue.placeId)));
  };

  const getTemplate = (venue: Venue) => {
    const base = customMessage.trim();
    if (base) return base;
    if (activeTemplate === "whatsapp") return MESSAGE_TEMPLATES.whatsapp(venue.name);
    if (activeTemplate === "sms") return MESSAGE_TEMPLATES.sms();
    return MESSAGE_TEMPLATES.email(venue.name);
  };

  const toggleChannel = (ch: "whatsapp" | "email" | "sms") => {
    setVisibleChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const sendViaApi = async (venue: Venue, channel: "whatsapp" | "sms") => {
    if (!venue.phone) return;
    const key = `${venue.placeId}-${channel}`;
    setSendingIds((prev) => new Set([...prev, key]));
    setSendErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    try {
      const response = await fetch("/api/admin/venue-outreach/send", {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: venue.phone, message: getTemplate(venue), channel }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setSendErrors((prev) => ({ ...prev, [key]: data.error ?? "Eroare trimitere" }));
        return;
      }
      void saveToLog(venue, channel);
    } catch {
      setSendErrors((prev) => ({ ...prev, [key]: "Eroare conexiune" }));
    } finally {
      setSendingIds((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const sendWhatsApp = (venue: Venue) => void sendViaApi(venue, "whatsapp");

  const sendEmail = (venue: Venue) => {
    const subject = encodeURIComponent(MESSAGE_TEMPLATES.emailSubject(venue.name));
    const body = encodeURIComponent(getTemplate(venue));
    const to = encodeURIComponent(venueEmails[venue.placeId] ?? "");
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`, "_blank");
    void saveToLog(venue, "email");
  };

  const sendSms = (venue: Venue) => void sendViaApi(venue, "sms");

  const sendBulk = () => {
    const targets = venues.filter((venue) => selected.has(venue.placeId));
    for (const venue of targets) {
      if (activeTemplate === "whatsapp" && venue.phone) sendWhatsApp(venue);
      else if (activeTemplate === "email") sendEmail(venue);
      else if (activeTemplate === "sms" && venue.phone) sendSms(venue);
    }
  };

  const selectedVenues = venues.filter((venue) => selected.has(venue.placeId));
  const contactableSelected = selectedVenues.filter((venue) =>
    activeTemplate === "email" ? true : !!venue.phone
  );

  const filteredLog = channelFilter === "all"
    ? logEntries
    : logEntries.filter((entry) => entry.channel === channelFilter);

  const channelLabel = { whatsapp: "WhatsApp", email: "Email", sms: "SMS" };
  const channelColor = {
    whatsapp: { bg: "#25D36622", border: "#25D36644", text: "#25D366" },
    email: { bg: "#2244aa22", border: "#2244aa44", text: "#6af" },
    sms: { bg: "#4a9922", border: "#4a9944", text: "#7d3" },
  };

  return (
    <div style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Venue Outreach</h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
        Caută restaurante și săli de evenimente și trimite-le un mesaj de colaborare.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #222" }}>
        {(["search", "contacted"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px", background: "none", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 600,
              color: tab === t ? "#c9a96e" : "#666",
              borderBottom: tab === t ? "2px solid #c9a96e" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t === "search" ? "Căutare" : `Contactate (${logEntries.length})`}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <>
          {/* Search bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); setCustomCity(""); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontSize: 14 }}
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Alt oraș..."
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontSize: 14, width: 160 }}
            />
            <span style={{ color: "#555", fontSize: 13 }}>sau</span>
            <input
              placeholder='Cuvânt cheie (ex: "Ballroom", "Events")'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#1a1a1a", color: "#fff", fontSize: 14, width: 240 }}
            />
            <button
              onClick={search}
              disabled={loading}
              style={{ padding: "8px 20px", borderRadius: 8, background: "#c9a96e", color: "#111", fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Se caută..." : "Caută"}
            </button>
            <button
              onClick={loadTestVenue}
              style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", color: "#555", fontWeight: 600, border: "1px solid #333", cursor: "pointer", fontSize: 12 }}
            >
              Test SMS
            </button>
          </div>

          {error && (
            <div style={{ background: "#2a1a1a", border: "1px solid #c44", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f88", fontSize: 13 }}>
              {error}
            </div>
          )}

          {venues.length > 0 && (
            <>
              {/* Template selector */}
              <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {(["whatsapp", "email", "sms"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => { setActiveTemplate(type); setEditingTemplate(false); setCustomMessage(""); }}
                      style={{
                        padding: "6px 14px", borderRadius: 6, border: "1px solid",
                        borderColor: activeTemplate === type ? "#c9a96e" : "#333",
                        background: activeTemplate === type ? "#c9a96e22" : "transparent",
                        color: activeTemplate === type ? "#c9a96e" : "#888",
                        fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "uppercase",
                      }}
                    >
                      {type === "whatsapp" ? "WhatsApp" : type === "email" ? "Email" : "SMS"}
                    </button>
                  ))}
                  <button
                    onClick={() => setEditingTemplate(!editingTemplate)}
                    style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}
                  >
                    {editingTemplate ? "Resetează template" : "Editează mesaj"}
                  </button>
                </div>

                {editingTemplate ? (
                  <textarea
                    value={customMessage || MESSAGE_TEMPLATES[activeTemplate === "email" ? "email" : activeTemplate === "sms" ? "sms" : "whatsapp"](venues[0]?.name ?? "Locație")}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={8}
                    style={{ width: "100%", background: "#0f0f0f", border: "1px solid #333", borderRadius: 6, color: "#ddd", padding: 12, fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
                  />
                ) : (
                  <pre style={{ background: "#0f0f0f", borderRadius: 6, padding: 12, color: "#bbb", fontSize: 12, whiteSpace: "pre-wrap", margin: 0, maxHeight: 180, overflow: "auto" }}>
                    {MESSAGE_TEMPLATES[activeTemplate === "email" ? "email" : activeTemplate === "sms" ? "sms" : "whatsapp"](venues[0]?.name ?? "Locație")}
                  </pre>
                )}
              </div>

              {/* Channel toggles */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#666" }}>Afișează butoane:</span>
                {(["whatsapp", "email", "sms"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid",
                      borderColor: visibleChannels.has(ch) ? channelColor[ch].border : "#333",
                      background: visibleChannels.has(ch) ? channelColor[ch].bg : "transparent",
                      color: visibleChannels.has(ch) ? channelColor[ch].text : "#555",
                      fontWeight: 600, fontSize: 11, cursor: "pointer", textTransform: "uppercase",
                    }}
                  >
                    {channelLabel[ch]}
                  </button>
                ))}
              </div>

              {/* Bulk actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <button onClick={toggleAll} style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  {selected.size === venues.length ? "Deselectează tot" : `Selectează tot (${venues.length})`}
                </button>
                {selected.size > 0 && (
                  <>
                    <span style={{ color: "#555", fontSize: 12 }}>|</span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>{selected.size} selectate</span>
                    <button
                      onClick={sendBulk}
                      disabled={contactableSelected.length === 0}
                      style={{ padding: "6px 14px", borderRadius: 6, background: "#c9a96e", color: "#111", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 13, opacity: contactableSelected.length === 0 ? 0.4 : 1 }}
                    >
                      Trimite {activeTemplate.toUpperCase()} ({contactableSelected.length})
                    </button>
                  </>
                )}
                <span style={{ marginLeft: "auto", color: "#555", fontSize: 12 }}>{venues.length} locații găsite</span>
              </div>

              {/* Venue list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {venues.map((venue) => {
                  const isSelected = selected.has(venue.placeId);
                  const isContacted = contactedIds.has(venue.placeId);

                  return (
                    <div
                      key={venue.placeId}
                      style={{
                        background: isSelected ? "#1a1a12" : "#111",
                        border: `1px solid ${isSelected ? "#c9a96e44" : isContacted ? "#4a944" : "#222"}`,
                        borderRadius: 10,
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        opacity: isContacted ? 0.65 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(venue.placeId)}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#c9a96e", flexShrink: 0 }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>{venue.name}</span>
                          {venue.rating && (
                            <span style={{ fontSize: 11, color: "#c9a96e", background: "#c9a96e18", padding: "2px 6px", borderRadius: 4 }}>
                              ★ {venue.rating} ({venue.reviewCount})
                            </span>
                          )}
                          {isContacted && (
                            <span style={{ fontSize: 11, color: "#4a9", background: "#4a921a", padding: "2px 6px", borderRadius: 4 }}>Contactat</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{venue.address}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                          {venue.phone && <span style={{ fontSize: 11, color: "#4a9" }}>📞 {venue.phone}</span>}
                          {venue.website && (
                            <a href={venue.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#6af" }}>
                              🌐 {new URL(venue.website).hostname}
                            </a>
                          )}
                          {!venue.phone && !venue.website && <span style={{ fontSize: 11, color: "#555" }}>Fără contact disponibil</span>}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                        {venue.phone && (visibleChannels.has("whatsapp") || visibleChannels.has("sms")) && (
                          <span style={{ fontSize: 12, color: "#888", fontFamily: "monospace", letterSpacing: "0.03em" }}>
                            {venue.phone}
                          </span>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          {venue.phone && visibleChannels.has("whatsapp") && (
                            <button
                              onClick={() => sendWhatsApp(venue)}
                              disabled={sendingIds.has(`${venue.placeId}-whatsapp`)}
                              title="WhatsApp"
                              style={{ padding: "6px 10px", borderRadius: 6, background: "#25D36622", border: "1px solid #25D36644", color: "#25D366", cursor: "pointer", fontSize: 13, opacity: sendingIds.has(`${venue.placeId}-whatsapp`) ? 0.5 : 1 }}
                            >
                              {sendingIds.has(`${venue.placeId}-whatsapp`) ? "..." : "WA"}
                            </button>
                          )}
                          {venue.phone && visibleChannels.has("sms") && (
                            <button
                              onClick={() => sendSms(venue)}
                              disabled={sendingIds.has(`${venue.placeId}-sms`)}
                              title="SMS"
                              style={{ padding: "6px 10px", borderRadius: 6, background: "#4a9922", border: "1px solid #4a9944", color: "#7d3", cursor: "pointer", fontSize: 13, opacity: sendingIds.has(`${venue.placeId}-sms`) ? 0.5 : 1 }}
                            >
                              {sendingIds.has(`${venue.placeId}-sms`) ? "..." : "SMS"}
                            </button>
                          )}
                          {visibleChannels.has("email") && (
                            <>
                              <input
                                type="email"
                                placeholder="email@locatie.ro"
                                value={venueEmails[venue.placeId] ?? ""}
                                onChange={(e) => setVenueEmails((prev) => ({ ...prev, [venue.placeId]: e.target.value }))}
                                style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #2244aa44", background: "#0f0f1a", color: "#aac", fontSize: 12, width: 150 }}
                              />
                              {venueEmails[venue.placeId]?.trim() && (
                                <button
                                  onClick={() => sendEmail(venue)}
                                  title={venueEmails[venue.placeId]}
                                  style={{ padding: "6px 10px", borderRadius: 6, background: "#2244aa22", border: "1px solid #2244aa44", color: "#6af", cursor: "pointer", fontSize: 13 }}
                                >
                                  Email
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {(sendErrors[`${venue.placeId}-whatsapp`] || sendErrors[`${venue.placeId}-sms`]) && (
                          <span style={{ fontSize: 10, color: "#f66" }}>
                            {sendErrors[`${venue.placeId}-whatsapp`] ?? sendErrors[`${venue.placeId}-sms`]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!loading && venues.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#444", fontSize: 14 }}>
              Selectează un oraș sau scrie un cuvânt cheie și apasă Caută.
            </div>
          )}
        </>
      )}

      {tab === "contacted" && (
        <>
          {/* Channel filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#666" }}>Filtrează:</span>
            {(["all", "whatsapp", "email", "sms"] as ChannelFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setChannelFilter(filter)}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "1px solid",
                  borderColor: channelFilter === filter ? "#c9a96e" : "#333",
                  background: channelFilter === filter ? "#c9a96e22" : "transparent",
                  color: channelFilter === filter ? "#c9a96e" : "#888",
                  fontWeight: 600, fontSize: 12, cursor: "pointer", textTransform: "uppercase",
                }}
              >
                {filter === "all" ? "Toate" : channelLabel[filter]}
              </button>
            ))}
            <span style={{ marginLeft: "auto", color: "#555", fontSize: 12 }}>{filteredLog.length} înregistrări</span>
          </div>

          {logLoading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#555", fontSize: 14 }}>Se încarcă...</div>
          )}

          {!logLoading && filteredLog.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#444", fontSize: 14 }}>
              Nicio locație contactată încă.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredLog.map((entry) => {
              const colors = channelColor[entry.channel];
              return (
                <div
                  key={entry.id}
                  style={{
                    background: "#111", border: "1px solid #222", borderRadius: 10,
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>{entry.name}</span>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
                        {channelLabel[entry.channel]}
                      </span>
                      {entry.city && (
                        <span style={{ fontSize: 11, color: "#666" }}>{entry.city}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.address}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {entry.phone && <span style={{ fontSize: 11, color: "#4a9" }}>📞 {entry.phone}</span>}
                      {entry.website && (
                        <a href={entry.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#6af" }}>
                          🌐 {new URL(entry.website).hostname}
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 11, color: "#555", textAlign: "right" }}>
                    {new Date(entry.sentAt).toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" })}
                    <br />
                    {new Date(entry.sentAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
