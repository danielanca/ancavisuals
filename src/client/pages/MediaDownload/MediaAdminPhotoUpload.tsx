/*
 * Purpose: "⬆️ Încarcă poze" on /media/:slug for the admin (🛠 Admin view only), so photos can be
 * added without opening the event in the dashboard. Reuses EventCard's AlbumPhotoUploader, which
 * talks to the event routes, so the album's event id is looked up first.
 */
import { useState } from "react";
import AlbumPhotoUploader from "../../features/admin/components/AlbumPhotoUploader";

type Props = {
  slug: string;
  accessToken: string;
  /** After originals + previews + ZIP are up: reload the album so the new photos show. */
  onUploaded: () => void;
};

export default function MediaAdminPhotoUpload({ slug, accessToken, onUploaded }: Props) {
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setStatus(null);
    if (eventId) return;
    setError(null);
    try {
      const response = await fetch(`/api/album/${encodeURIComponent(slug)}/admin-event`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({})) as { eventId?: string; error?: string };
      if (!response.ok || !data.eventId) throw new Error(data.error ?? "Nu găsesc evenimentul albumului.");
      setEventId(data.eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu găsesc evenimentul albumului.");
    }
  };

  const complete = async () => {
    setOpen(false);
    setStatus("✅ Poze încărcate. Se verifică pe server preview-urile și ZIP-ul…");
    onUploaded();
    // Same as EventCard: the server only repairs what the browser could not finish.
    try {
      await fetch(`/api/admin/events/${eventId}/process-album`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch { /* The durable processing sweeper picks the album up anyway. */ }
  };

  return (
    <section aria-label="Încarcă poze" className="mb-5 border border-neutral-700 bg-neutral-950 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">🛠 Poze album</p>
        <button
          type="button"
          onClick={() => void toggle()}
          className="border border-white bg-white px-3 py-1.5 text-xs font-bold text-black"
        >
          {open ? "Ascunde upload" : "⬆️ Încarcă poze"}
        </button>
      </div>
      {status && <p role="status" className="mt-2 text-xs text-emerald-400">{status}</p>}
      {open && error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {open && !error && !eventId && <p className="mt-2 text-xs text-neutral-400">Se caută evenimentul…</p>}
      {open && eventId && (
        <div className="mt-3">
          <AlbumPhotoUploader eventId={eventId} albumSlug={slug} accessToken={accessToken} onComplete={() => void complete()} />
        </div>
      )}
    </section>
  );
}
