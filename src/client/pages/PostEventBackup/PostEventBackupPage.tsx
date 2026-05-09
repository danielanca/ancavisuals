import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

type BackupStatusResponse = {
  event?: {
    id: string;
    name: string;
    eventDate: string | null;
    albumSlug: string | null;
    confirmedAt: string | null;
    proofUrl: string | null;
    proofName: string | null;
  };
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Data evenimentului nu este disponibilă.";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });
}

const cardClass = "mx-auto w-full max-w-3xl rounded-[28px] border border-stone-200 bg-white/92 p-6 shadow-[0_30px_80px_rgba(45,23,13,0.12)] backdrop-blur sm:p-8";

export default function PostEventBackupPage() {
  const { eventId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [eventData, setEventData] = useState<BackupStatusResponse["event"] | null>(null);

  const loadStatus = async () => {
    if (!eventId || !token) {
      setError("Linkul de backup nu este valid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/post-event-backup/status?token=${encodeURIComponent(token)}`);
      const data = await res.json() as BackupStatusResponse;
      if (!res.ok || !data.event) {
        throw new Error(data.error || "Nu am putut încărca pagina de backup.");
      }
      setEventData(data.event);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Nu am putut încărca pagina de backup.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus().catch(() => {});
  }, [eventId, token]);

  const handleSubmit = async () => {
    if (!eventId || !token || saving) return;
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("token", token);
      if (selectedFile) formData.append("proof", selectedFile);

      const res = await fetch(`/api/admin/events/${eventId}/post-event-backup/submit`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as { error?: string; confirmedAt?: string | null; proofUrl?: string | null; proofName?: string | null };
      if (!res.ok) {
        throw new Error(data.error || "Nu am putut salva confirmarea backup-ului.");
      }

      setEventData(current => current ? {
        ...current,
        confirmedAt: data.confirmedAt ?? new Date().toISOString(),
        proofUrl: data.proofUrl ?? current.proofUrl,
        proofName: data.proofName ?? current.proofName,
      } : current);
      setSelectedFile(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Nu am putut salva confirmarea backup-ului.");
    } finally {
      setSaving(false);
    }
  };

  const isConfirmed = Boolean(eventData?.confirmedAt);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,_#f8f1ea_0%,_#f2e6db_46%,_#efe5dc_100%)] px-4 py-10 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-amber-700">Post Event Backup</p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
            Confirmă backup-ul materialelor
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
            Pagina asta păstrează statusul pentru pozele și video-urile evenimentului. Poți marca backup-ul și poți încărca o poză ca dovadă.
          </p>
        </div>

        {loading ? (
          <section className={cardClass}>
            <p className="text-sm text-stone-500">Se încarcă statusul backup-ului...</p>
          </section>
        ) : error ? (
          <section className={cardClass}>
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              {error}
            </div>
          </section>
        ) : eventData ? (
          <section className={cardClass}>
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {isConfirmed ? "Backup confirmat" : "Backup în așteptare"}
                  </span>
                  <span className="text-sm text-stone-500">{eventData.name}</span>
                </div>

                <div>
                  <h2 className="text-2xl font-semibold text-stone-950">{eventData.name}</h2>
                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    Eveniment: <span className="font-medium text-stone-800">{formatDate(eventData.eventDate)}</span>
                  </p>
                  {eventData.confirmedAt ? (
                    <p className="mt-2 text-sm leading-7 text-emerald-700">
                      Backup-ul a fost marcat pe {formatDate(eventData.confirmedAt)}.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      După ce verifici că materialele sunt salvate corect, apasă butonul de mai jos. Nu vei mai primi remindere pentru acest eveniment.
                    </p>
                  )}
                </div>

                {eventData.proofUrl && (
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Dovadă salvată</p>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                      <img src={eventData.proofUrl} alt="Dovadă backup" className="h-64 w-full object-cover" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <a href={eventData.proofUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-amber-700 transition-colors hover:text-amber-800">
                        Deschide poza
                      </a>
                      {eventData.proofName && <span className="text-stone-500">{eventData.proofName}</span>}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Se salvează..." : isConfirmed ? "Actualizează statusul backup" : "Am făcut backup-ul"}
                  </button>
                  {eventData.albumSlug && (
                    <Link
                      to={`/media/${eventData.albumSlug}`}
                      className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-400 hover:text-stone-950"
                    >
                      Deschide albumul
                    </Link>
                  )}
                </div>
              </div>

              <aside className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Dovadă opțională</p>
                <h3 className="mt-2 text-lg font-semibold text-stone-950">Atașează o poză</h3>
                <p className="mt-2 text-sm leading-7 text-stone-600">
                  Poți încărca un screenshot sau o fotografie care arată că backup-ul există pe disc, NAS, cloud sau în alt sistem de arhivare.
                </p>

                <label className="mt-5 flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-300 bg-white px-5 py-6 text-center transition-colors hover:border-amber-400">
                  <span className="text-sm font-medium text-stone-800">
                    {selectedFile ? selectedFile.name : "Alege o imagine"}
                  </span>
                  <span className="mt-2 text-xs leading-6 text-stone-500">
                    JPG, PNG, WEBP. Maximum 20MB.
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="mt-3 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
                  >
                    Elimină poza selectată
                  </button>
                )}
              </aside>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
