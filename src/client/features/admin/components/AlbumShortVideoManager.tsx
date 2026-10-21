/*
 * Purpose: admin control for the album's "Video scurt" — upload the file straight to Bunny
 * ({slug}/shortvideo/, replaces the previous one) or save a link instead. Used in EventCard
 * and on /media/:slug (🛠 Admin), so both places edit the same video.
 */
import { useEffect, useRef, useState } from "react";
import {
  SHORT_VIDEO_ACCEPT,
  SHORT_VIDEO_MAX_BYTES,
  sanitizeShortVideoName,
  type AlbumShortVideo,
} from "../../../../shared/albumShortVideo";
import { normalizeVideoLink, type AlbumVideoLinks } from "../../../../shared/albumVideoLinks";

type Props = {
  slug: string;
  accessToken: string | null | undefined;
  /** Called after an upload or delete, so the page can reload the album. */
  onChanged?: (video: AlbumShortVideo | null) => void;
  /** /media already shows the link form in its own section. */
  showLinkForm?: boolean;
};

const STREAM_LABEL: Record<NonNullable<AlbumShortVideo["stream"]>["status"], string> = {
  processing: "se procesează (clientul vede între timp originalul)",
  ready: "gata, calitate după viteza internetului",
  failed: "eșuat, clientul vede originalul",
};

const fmtMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 1024 ** 3 ? 0 : 1)} MB`;

export default function AlbumShortVideoManager({ slug, accessToken, onChanged, showLinkForm = true }: Props) {
  const [video, setVideo] = useState<AlbumShortVideo | null>(null);
  const [links, setLinks] = useState<AlbumVideoLinks>({});
  const [linkDraft, setLinkDraft] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const base = `/api/album/${encodeURIComponent(slug)}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/short-video`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { video?: AlbumShortVideo | null } | null) => { if (!cancelled) setVideo(data?.video ?? null); })
      .catch(() => { if (!cancelled) setVideo(null); });
    if (showLinkForm) {
      fetch(`${base}/video-links`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { links?: AlbumVideoLinks } | null) => {
          if (cancelled) return;
          setLinks(data?.links ?? {});
          setLinkDraft(data?.links?.short ?? "");
        })
        .catch(() => {});
    }
    return () => { cancelled = true; xhrRef.current?.abort(); };
  }, [base, showLinkForm]);

  const upload = (file: File) => {
    const fileName = sanitizeShortVideoName(file.name);
    if (!fileName) { setMessage({ ok: false, text: "Format acceptat: MP4, MOV, M4V sau WEBM." }); return; }
    if (file.size > SHORT_VIDEO_MAX_BYTES) { setMessage({ ok: false, text: "Videoul depășește 4 GB." }); return; }
    setMessage(null);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", `${base}/short-video`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken ?? ""}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setProgress(null);
      xhrRef.current = null;
      let data: { video?: AlbumShortVideo; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* nginx HTML error page */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.video) {
        setVideo(data.video);
        setMessage({ ok: true, text: "Video încărcat — clientul îl vede și îl poate descărca." });
        onChanged?.(data.video);
      } else if (xhr.status === 413 && !data.error) {
        setMessage({ ok: false, text: "nginx a respins fișierul (413): mărește client_max_body_size pentru /api/album/*/short-video." });
      } else {
        setMessage({ ok: false, text: data.error ?? `Încărcarea a eșuat (${xhr.status}). Reîncearcă.` });
      }
    };
    xhr.onerror = () => { setProgress(null); xhrRef.current = null; setMessage({ ok: false, text: "Conexiunea s-a întrerupt. Reîncearcă." }); };
    xhr.onabort = () => { setProgress(null); xhrRef.current = null; };
    xhr.send(file);
  };

  const remove = async () => {
    if (!window.confirm(`Ștergi videoul scurt „${video?.fileName}” din album?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`${base}/short-video`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken ?? ""}` } });
      if (!response.ok) throw new Error();
      setVideo(null);
      setMessage({ ok: true, text: "Video șters." });
      onChanged?.(null);
    } catch {
      setMessage({ ok: false, text: "Videoul nu a putut fi șters." });
    } finally {
      setBusy(false);
    }
  };

  const saveLink = async (link: string) => {
    if (normalizeVideoLink(link) === null) { setMessage({ ok: false, text: "Linkul trebuie să înceapă cu https://" }); return; }
    setBusy(true);
    try {
      const response = await fetch(`${base}/video-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken ?? ""}` },
        body: JSON.stringify({ short: link.trim() }),
      });
      if (!response.ok) throw new Error(response.status === 400 ? "Link invalid." : "Nu s-a putut salva.");
      const data = await response.json() as { links?: AlbumVideoLinks };
      setLinks(data.links ?? {});
      setLinkDraft(data.links?.short ?? "");
      setMessage({ ok: true, text: link.trim() ? "Link salvat." : "Link șters." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error && error.message ? error.message : "Nu s-a putut salva." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress !== null;

  return (
    <div className="space-y-2 border border-neutral-700 bg-neutral-950 p-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">🛠 Video scurt</p>

      <div className="flex flex-wrap items-center gap-2">
        {video ? (
          <span className="text-xs text-neutral-300">
            🎬 <span className="font-mono">{video.fileName}</span>{video.size ? ` · ${fmtMb(video.size)}` : ""}
            {video.stream && <span className="ml-2 text-neutral-500">· Stream: {STREAM_LABEL[video.stream.status]}</span>}
          </span>
        ) : (
          <span className="text-xs text-neutral-500">Niciun fișier încărcat.</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={SHORT_VIDEO_ACCEPT}
          className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upload(file); }}
        />
        <button
          type="button"
          disabled={uploading || busy}
          onClick={() => inputRef.current?.click()}
          className="border border-white bg-white px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
        >
          {video ? "⬆️ Înlocuiește video" : "⬆️ Încarcă video"}
        </button>
        {video && !uploading && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="border border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:border-white disabled:opacity-40"
          >
            Șterge
          </button>
        )}
        {uploading && (
          <button
            type="button"
            onClick={() => xhrRef.current?.abort()}
            className="border border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:border-white"
          >
            Anulează
          </button>
        )}
      </div>

      {uploading && (
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full bg-neutral-800">
          <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {uploading && <p className="text-xs text-neutral-400">Se încarcă… {progress}% — nu închide pagina.</p>}

      {showLinkForm && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void saveLink(linkDraft); }}>
          <input
            type="url"
            inputMode="url"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            placeholder="sau link: https://youtube.com/shorts/... / Drive / Vimeo"
            aria-label="Link video scurt"
            className="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-1.5 text-xs text-white outline-none focus:border-white"
          />
          <button
            type="submit"
            disabled={busy || !linkDraft.trim() || linkDraft.trim() === (links.short ?? "")}
            className="border border-neutral-500 px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            {links.short ? "Înlocuiește link" : "Salvează link"}
          </button>
          {links.short && (
            <button
              type="button"
              disabled={busy}
              onClick={() => { if (window.confirm("Ștergi linkul videoului scurt?")) void saveLink(""); }}
              className="border border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:border-white disabled:opacity-40"
            >
              Șterge link
            </button>
          )}
        </form>
      )}
      {video && links.short && showLinkForm && (
        <p className="text-xs text-neutral-500">Clientul vede fișierul încărcat; linkul rămâne de rezervă.</p>
      )}

      {message && <p role="status" className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}
