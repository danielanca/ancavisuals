import React, { useEffect, useMemo, useState } from "react";
import Loader from "../../../components/UI/Loader";
import { useWeddingHub } from "../context/WeddingHubContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";

type MockRsvpStatus = "asteptare" | "confirmat" | "refuzat";
type MockAudience = "all" | "confirmed" | "declined" | "waiting" | "with-table" | "without-table";
type MockChannel = "email" | "sms";

type MockGuest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rsvpStatus: MockRsvpStatus;
  tableName: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  rsvpHistory: Array<{
    id: string;
    status: MockRsvpStatus;
    reason: string | null;
    createdAt: string;
  }>;
};

type MockBroadcast = {
  id: string;
  subject: string;
  message: string;
  audience: MockAudience;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
  scheduledFor: string | null;
  status: "queued" | "processing" | "sent" | "partial" | "failed";
  recipientCount: number;
  emailCount: number;
  smsCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  fallbackCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  deliveries: Array<{
    id: string;
    guestId: string;
    guestName: string;
    channel: MockChannel;
    recipient: string;
    fallbackFrom: MockChannel | null;
    status: "sent" | "failed" | "skipped";
    errorMessage: string | null;
    createdAt: string;
  }>;
  warnings: Array<{ guestName: string; fromChannel: MockChannel; toChannel: MockChannel }>;
  failures: Array<{ guestName: string; channel: MockChannel; recipient: string; reason: string }>;
};

type MockActivity = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

type MockSession = {
  weddingId: string;
  weddingName: string;
  guests: MockGuest[];
  broadcasts: MockBroadcast[];
  activities: MockActivity[];
  updatedAt: string;
};

type MockStatus = {
  enabled: boolean;
  weddingId: string;
  weddingName: string;
  guestCount: number;
  broadcastCount: number;
  latestActivity: MockActivity | null;
};

type MockPreview = {
  summary: {
    recipientCount: number;
    emailCount: number;
    smsCount: number;
    fallbackCount: number;
    skippedCount: number;
  };
  warnings: Array<{ guestName: string; fromChannel: MockChannel; toChannel: MockChannel }>;
  recipients: Array<{
    guestId: string;
    guestName: string;
    channels: Array<{
      channel: MockChannel;
      recipient: string;
      fallbackFrom: MockChannel | null;
    }>;
    skippedReason: string | null;
  }>;
};

const MOCKS_ENABLED = import.meta.env.VITE_WEDDING_HUB_MOCKS === "1";

const DEFAULT_RSVP_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
  reason: "",
};

const DEFAULT_BROADCAST_FORM = {
  subject: "Mesaj mock către invitați",
  message: "Acesta este un mesaj simulat pentru testare.",
  audience: "confirmed" as MockAudience,
  sendEmailToGuests: true,
  sendSmsToGuests: true,
  scheduledMinutes: "0",
};

function formatDateTime(value: string | null): string {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString("ro-RO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function badgeClass(status: string): string {
  switch (status) {
    case "sent":
    case "confirmat":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "processing":
    case "asteptare":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "failed":
    case "refuzat":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    default:
      return "border-neutral-700 bg-neutral-800 text-neutral-300";
  }
}

const WeddingMockLabPage: React.FC = () => {
  const { state } = useWeddingHub();
  const { coupleAuth } = useWeddingHubAuth();
  const { weddingProfile, loadingProfile, loadingGuests } = state;
  const [status, setStatus] = useState<MockStatus | null>(null);
  const [session, setSession] = useState<MockSession | null>(null);
  const [preview, setPreview] = useState<MockPreview | null>(null);
  const [guestHistory, setGuestHistory] = useState<{
    guest: MockGuest | null;
    rsvpHistory: Array<{ id: string; status: MockRsvpStatus; reason: string | null; createdAt: string }>;
    deliveries: Array<{
      broadcastId: string;
      subject: string;
      channel: MockChannel;
      recipient: string;
      status: "sent" | "failed" | "skipped";
      fallbackFrom: MockChannel | null;
      errorMessage: string | null;
      createdAt: string;
    }>;
  } | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [rsvpForm, setRsvpForm] = useState(DEFAULT_RSVP_FORM);
  const [rsvpStatus, setRsvpStatus] = useState<MockRsvpStatus>("confirmat");
  const [broadcastForm, setBroadcastForm] = useState(DEFAULT_BROADCAST_FORM);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const authToken = coupleAuth.coupleAccessToken;

  const currentGuest = useMemo(
    () => session?.guests.find((guest) => guest.id === selectedGuestId) ?? null,
    [selectedGuestId, session],
  );

  const loadSession = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mock/wedding-hub/session", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json() as { session?: MockSession; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nu s-a putut încărca sesiunea mock.");
      }
      setSession(data.session ?? null);
      if (!selectedGuestId && data.session?.guests?.[0]?.id) {
        setSelectedGuestId(data.session.guests[0].id);
      }
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch("/api/mock/wedding-hub/status", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json() as MockStatus & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Zona mock nu este disponibilă.");
      }
      setStatus(data);
    } catch (error: unknown) {
      setStatus(null);
      setErrorMessage((error as Error).message);
    }
  };

  const loadGuestHistory = async (guestId: string) => {
    if (!guestId) {
      setGuestHistory(null);
      return;
    }
    try {
      const response = await fetch(`/api/mock/wedding-hub/guests/${guestId}/history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json() as {
        guest?: MockGuest;
        rsvpHistory?: Array<{ id: string; status: MockRsvpStatus; reason: string | null; createdAt: string }>;
        deliveries?: Array<{
          broadcastId: string;
          subject: string;
          channel: MockChannel;
          recipient: string;
          status: "sent" | "failed" | "skipped";
          fallbackFrom: MockChannel | null;
          errorMessage: string | null;
          createdAt: string;
        }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Nu s-a putut încărca istoricul invitatului.");
      }
      setGuestHistory({
        guest: data.guest ?? null,
        rsvpHistory: data.rsvpHistory ?? [],
        deliveries: data.deliveries ?? [],
      });
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    }
  };

  useEffect(() => {
    if (!MOCKS_ENABLED || !authToken || !coupleAuth.coupleAuthorised) return;
    void loadStatus();
    void loadSession();
  }, [authToken, coupleAuth.coupleAuthorised]);

  useEffect(() => {
    void loadGuestHistory(selectedGuestId);
  }, [selectedGuestId]);

  useEffect(() => {
    if (!currentGuest) return;
    setRsvpForm({
      firstName: currentGuest.firstName,
      lastName: currentGuest.lastName,
      email: currentGuest.email,
      phone: currentGuest.phone,
      notes: currentGuest.notes,
      reason: "",
    });
    setRsvpStatus(currentGuest.rsvpStatus);
  }, [currentGuest?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (MOCKS_ENABLED && authToken && coupleAuth.coupleAuthorised) {
        void loadStatus();
        void loadSession();
      }
    }, 6000);
    return () => window.clearInterval(timer);
  }, [authToken, coupleAuth.coupleAuthorised]);

  const refreshAll = async () => {
    await Promise.all([loadStatus(), loadSession()]);
    if (selectedGuestId) {
      await loadGuestHistory(selectedGuestId);
    }
  };

  const resetMockZone = async (guestCount = 12) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mock/wedding-hub/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ guestCount }),
      });
      const data = await response.json() as { session?: MockSession; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nu s-a putut reseta zona mock.");
      setSession(data.session ?? null);
      setSelectedGuestId(data.session?.guests?.[0]?.id ?? "");
      await loadStatus();
      await loadGuestHistory(data.session?.guests?.[0]?.id ?? "");
      setSuccessMessage(`Zona mock a fost resetată cu ${guestCount} invitați.`);
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const seedMockZone = async (guestCount = 24) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mock/wedding-hub/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ guestCount }),
      });
      const data = await response.json() as { session?: MockSession; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nu s-au putut genera invitații mock.");
      setSession(data.session ?? null);
      setSelectedGuestId(data.session?.guests?.[0]?.id ?? "");
      await loadStatus();
      await loadGuestHistory(data.session?.guests?.[0]?.id ?? "");
      setSuccessMessage(`Au fost generați ${guestCount} invitați mock.`);
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitRsvp = async () => {
    if (!rsvpForm.firstName.trim() || !rsvpForm.lastName.trim()) {
      setErrorMessage("Completează numele pentru simularea RSVP.");
      return;
    }

    setSubmittingRsvp(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mock/wedding-hub/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
          body: JSON.stringify({
            guestId: selectedGuestId || null,
            firstName: rsvpForm.firstName,
            lastName: rsvpForm.lastName,
            email: rsvpForm.email,
            phone: rsvpForm.phone,
            notes: rsvpForm.notes,
            reason: rsvpForm.reason,
            status: rsvpStatus,
          }),
        });
      const data = await response.json() as { guest?: MockGuest; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nu s-a putut salva RSVP-ul mock.");
      await refreshAll();
      if (data.guest?.id) {
        setSelectedGuestId(data.guest.id);
        await loadGuestHistory(data.guest.id);
      }
      setSuccessMessage(`RSVP-ul simulat a fost salvat pentru ${rsvpForm.firstName} ${rsvpForm.lastName}.`);
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    } finally {
      setSubmittingRsvp(false);
    }
  };

  const previewBroadcast = async () => {
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mock/wedding-hub/messages/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          audience: broadcastForm.audience,
          sendEmailToGuests: broadcastForm.sendEmailToGuests,
          sendSmsToGuests: broadcastForm.sendSmsToGuests,
        }),
      });
      const data = await response.json() as MockPreview & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nu s-a putut genera preview-ul.");
      setPreview(data);
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    }
  };

  const queueBroadcast = async () => {
    if (!broadcastForm.subject.trim() || !broadcastForm.message.trim()) {
      setErrorMessage("Subiectul și mesajul sunt obligatorii.");
      return;
    }

    setSendingBroadcast(true);
    setErrorMessage(null);
    try {
      const scheduledFor =
        Number(broadcastForm.scheduledMinutes) > 0
          ? new Date(Date.now() + Number(broadcastForm.scheduledMinutes) * 60_000).toISOString()
          : null;

      const response = await fetch("/api/mock/wedding-hub/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          subject: broadcastForm.subject,
          message: broadcastForm.message,
          audience: broadcastForm.audience,
          sendEmailToGuests: broadcastForm.sendEmailToGuests,
          sendSmsToGuests: broadcastForm.sendSmsToGuests,
          scheduledFor,
        }),
      });
      const data = await response.json() as { broadcast?: MockBroadcast; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nu s-a putut pune în coadă mesajul mock.");
      setSuccessMessage(`Mesajul mock a fost pus în coadă: ${data.broadcast?.subject ?? broadcastForm.subject}.`);
      await refreshAll();
    } catch (error: unknown) {
      setErrorMessage((error as Error).message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loadingProfile || loadingGuests) {
    return <Loader variant="fullscreen" />;
  }

  if (!MOCKS_ENABLED) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-300">
        <p className="text-lg text-white">Zona mock este dezactivată.</p>
        <p className="mt-2 text-sm text-neutral-400">
          Activează `VITE_WEDDING_HUB_MOCKS=1` în frontend și `WEDDING_HUB_MOCKS=1` pe server ca să poți simula RSVP, mesaje și istoricul lor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-rose-300">Mock zone</p>
            <h1 className="mt-2 text-2xl font-light text-white">Simulator Wedding Hub</h1>
            <p className="mt-1 max-w-2xl text-sm text-neutral-400">
              Aici testezi RSVP, broadcast-uri și fallback-uri fără să atingi datele reale.
              {weddingProfile ? ` Contextul curent este pentru ${weddingProfile.brideFirstName} & ${weddingProfile.groomFirstName}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              Reîncarcă
            </button>
            <button
              type="button"
              onClick={() => void resetMockZone(12)}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition-colors hover:bg-rose-500/20"
            >
              Reset demo
            </button>
            <button
              type="button"
              onClick={() => void seedMockZone(24)}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/20"
            >
              Generează 24 invitați
            </button>
          </div>
          </div>
          {loading && <p className="text-xs text-neutral-500">Se sincronizează zona mock...</p>}

        {status && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Status</p>
              <p className="mt-2 text-lg text-white">{status.enabled ? "Activ" : "Inactiv"}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Invitați</p>
              <p className="mt-2 text-lg text-white">{status.guestCount}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Broadcast-uri</p>
              <p className="mt-2 text-lg text-white">{status.broadcastCount}</p>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {successMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-light text-white">Simulator RSVP</h2>
              <p className="text-sm text-neutral-400">Schimbi rapid statusul unui invitat, exact ca și cum ar răspunde din linkul public.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${badgeClass(currentGuest?.rsvpStatus ?? "asteptare")}`}>
              {currentGuest?.rsvpStatus ?? "așteptare"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-300">Invitat existent</span>
              <select
                value={selectedGuestId}
                onChange={(event) => setSelectedGuestId(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
              >
                <option value="">Alege un invitat</option>
                {session?.guests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.firstName} {guest.lastName} · {guest.rsvpStatus}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-300">Status simulat</span>
              <select
                value={rsvpStatus}
                onChange={(event) => setRsvpStatus(event.target.value as MockRsvpStatus)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
              >
                <option value="confirmat">confirmat</option>
                <option value="refuzat">refuzat</option>
                <option value="asteptare">așteptare</option>
              </select>
            </label>

            <input
              value={rsvpForm.firstName}
              onChange={(event) => setRsvpForm((current) => ({ ...current, firstName: event.target.value }))}
              placeholder="Prenume"
              className="rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
            />
            <input
              value={rsvpForm.lastName}
              onChange={(event) => setRsvpForm((current) => ({ ...current, lastName: event.target.value }))}
              placeholder="Nume"
              className="rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
            />
            <input
              value={rsvpForm.email}
              onChange={(event) => setRsvpForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              className="rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
            />
            <input
              value={rsvpForm.phone}
              onChange={(event) => setRsvpForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Telefon"
              className="rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
            />
            <input
              value={rsvpForm.reason}
              onChange={(event) => setRsvpForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Motiv refuz"
              className="rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
            />
            <textarea
              value={rsvpForm.notes}
              onChange={(event) => setRsvpForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Note"
              rows={3}
              className="rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500 sm:col-span-2"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submitRsvp()}
              disabled={submittingRsvp}
              className="rounded-xl bg-rose-500 px-4 py-3 text-sm text-white transition-colors hover:bg-rose-400 disabled:opacity-50"
            >
              {submittingRsvp ? "Se salvează..." : "Salvează RSVP mock"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRsvpForm(DEFAULT_RSVP_FORM);
                setSelectedGuestId("");
                setRsvpStatus("confirmat");
              }}
              className="rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              Curăță formularul
            </button>
          </div>

          {session?.guests?.length ? (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-neutral-300">Ultimii invitați mock</h3>
                <p className="text-xs text-neutral-500">click pe un nume pentru istoric</p>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-2xl border border-neutral-800">
                {session.guests.slice(0, 12).map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => setSelectedGuestId(guest.id)}
                    className={`flex w-full items-center justify-between border-b border-neutral-800 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-800/70 ${
                      selectedGuestId === guest.id ? "bg-neutral-800/70" : "bg-neutral-950/50"
                    }`}
                  >
                    <div>
                      <p className="text-sm text-white">{guest.firstName} {guest.lastName}</p>
                      <p className="text-xs text-neutral-500">{guest.email || guest.phone || "fără contact"}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] ${badgeClass(guest.rsvpStatus)}`}>
                      {guest.rsvpStatus}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-light text-white">Mesaje mock</h2>
              <p className="text-sm text-neutral-400">Preview dry-run + coadă simulată. Nu pleacă nimic în exterior.</p>
            </div>
            <span className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs text-neutral-300">
              queue simulator
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-300">Subiect</span>
              <input
                value={broadcastForm.subject}
                onChange={(event) => setBroadcastForm((current) => ({ ...current, subject: event.target.value }))}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-300">Mesaj</span>
              <textarea
                value={broadcastForm.message}
                onChange={(event) => setBroadcastForm((current) => ({ ...current, message: event.target.value }))}
                rows={5}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-neutral-300">Audiență</span>
                <select
                  value={broadcastForm.audience}
                  onChange={(event) => setBroadcastForm((current) => ({ ...current, audience: event.target.value as MockAudience }))}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                >
                  <option value="confirmed">Doar confirmați</option>
                  <option value="all">Toți invitații</option>
                  <option value="waiting">În așteptare</option>
                  <option value="declined">Refuzați</option>
                  <option value="with-table">Cu masă</option>
                  <option value="without-table">Fără masă</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-neutral-300">Programare în minute</span>
                <input
                  type="number"
                  min={0}
                  value={broadcastForm.scheduledMinutes}
                  onChange={(event) => setBroadcastForm((current) => ({ ...current, scheduledMinutes: event.target.value }))}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={broadcastForm.sendEmailToGuests}
                  onChange={(event) => setBroadcastForm((current) => ({ ...current, sendEmailToGuests: event.target.checked }))}
                />
                Trimite email
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={broadcastForm.sendSmsToGuests}
                  onChange={(event) => setBroadcastForm((current) => ({ ...current, sendSmsToGuests: event.target.checked }))}
                />
                Trimite SMS
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void previewBroadcast()}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 transition-colors hover:bg-amber-500/20"
              >
                Preview dry-run
              </button>
              <button
                type="button"
                onClick={() => void queueBroadcast()}
                disabled={sendingBroadcast}
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {sendingBroadcast ? "Se pune în coadă..." : "Pune în coadă"}
              </button>
            </div>
          </div>

          {preview && (
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-neutral-200">Rezultatul preview-ului</h3>
                <span className="text-xs text-neutral-500">fără trimitere reală</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
                  <p className="text-xs text-neutral-500">destinatari</p>
                  <p className="mt-1 text-white">{preview.summary.recipientCount}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
                  <p className="text-xs text-neutral-500">email</p>
                  <p className="mt-1 text-white">{preview.summary.emailCount}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
                  <p className="text-xs text-neutral-500">sms</p>
                  <p className="mt-1 text-white">{preview.summary.smsCount}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
                  <p className="text-xs text-neutral-500">fallback</p>
                  <p className="mt-1 text-white">{preview.summary.fallbackCount}</p>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
                  <p className="text-xs text-neutral-500">skip</p>
                  <p className="mt-1 text-white">{preview.summary.skippedCount}</p>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Fallback-uri detectate: {preview.warnings.map((item) => item.guestName).join(", ")}
                </div>
              )}
            </div>
          )}

          {guestHistory?.guest && (
            <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
              <h3 className="text-sm font-medium text-neutral-200">Istoric per destinatar</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {guestHistory.guest.firstName} {guestHistory.guest.lastName} · {guestHistory.guest.rsvpStatus}
              </p>
              <div className="mt-4 space-y-3">
                {guestHistory.rsvpHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.status}</span>
                      <span className="text-xs text-neutral-500">{formatDateTime(item.createdAt)}</span>
                    </div>
                    {item.reason && <p className="mt-1 text-xs text-neutral-400">{item.reason}</p>}
                  </div>
                ))}
                {guestHistory.deliveries.map((item) => (
                  <div key={`${item.broadcastId}-${item.createdAt}-${item.channel}`} className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.subject}</span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${badgeClass(item.status)}`}>{item.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      canal: {item.channel} · recipient: {item.recipient} · {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                ))}
                {guestHistory.deliveries.length === 0 && guestHistory.rsvpHistory.length === 0 && (
                  <p className="text-sm text-neutral-500">Niciun istoric încă.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-light text-white">Activitate recentă</h2>
          <div className="mt-4 space-y-3">
            {session?.activities.length ? session.activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{activity.title}</p>
                  <span className="text-xs text-neutral-500">{formatDateTime(activity.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">{activity.detail}</p>
              </div>
            )) : (
              <p className="text-sm text-neutral-500">Nu există activitate încă.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-light text-white">Broadcast-uri mock</h2>
          <div className="mt-4 space-y-3">
            {session?.broadcasts.length ? session.broadcasts.slice(0, 6).map((broadcast) => (
              <div key={broadcast.id} className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{broadcast.subject}</p>
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${badgeClass(broadcast.status)}`}>
                    {broadcast.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  destinatari: {broadcast.recipientCount} · fallback: {broadcast.fallbackCount} · {formatDateTime(broadcast.createdAt)}
                </p>
              </div>
            )) : (
              <p className="text-sm text-neutral-500">Nu există broadcast-uri încă.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeddingMockLabPage;
