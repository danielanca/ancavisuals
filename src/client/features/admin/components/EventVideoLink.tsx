import React, { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import { normalizeEventVideoLink } from "../../../../shared/eventVideoLink";

export default function EventVideoLink({ eventId, videoUrl = "", onSaved }: { eventId: string; videoUrl?: string; onSaved?: (videoUrl: string) => void }) {
  const { auth } = useAuth();
  const [saved, setSaved] = useState(videoUrl);
  const [draft, setDraft] = useState(videoUrl);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSaved(videoUrl); }, [videoUrl]);
  const safeLink = normalizeEventVideoLink(saved);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const link = normalizeEventVideoLink(draft);
    if (link === null) { setError("Introdu un link video valid, care începe cu https:// sau http://."); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/video-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ videoUrl: link }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Nu s-a putut salva linkul video.");
      setSaved(link);
      setEditing(false);
      onSaved?.(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu s-a putut salva linkul video.");
    } finally { setSaving(false); }
  };

  return (
    <div className="border-t border-neutral-800 pt-3 space-y-2">
      <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">Video eveniment</p>
      {safeLink && <a href={safeLink} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-violet-400 hover:text-violet-300">Deschide videoul ↗</a>}
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <label className="block text-xs text-neutral-400">
            Link video
            <input type="url" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={saving} placeholder="https://drive.google.com/file/d/…/view" className="mt-1 w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-violet-400" />
          </label>
          <p className="text-xs text-neutral-500">Adaugă linkul de partajare Google Drive. Videoul rămâne pe Drive. Pentru a elimina linkul, golește câmpul și salvează.</p>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">{saving ? "Se salvează…" : "Salvează linkul"}</button>
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(null); }} className="text-xs text-neutral-400 hover:text-white disabled:opacity-50">Anulează</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setDraft(saved); setError(null); setEditing(true); }} className="block text-xs text-violet-400 hover:text-violet-300">{saved ? "Editează linkul video" : "Adaugă link video"}</button>
      )}
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
