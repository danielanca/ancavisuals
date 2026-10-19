import { useState } from "react";
import { remoteAddress } from "../../utils/address";
import { coupleLinkPath } from "../../../shared/media/shareLinks";

/** EventCard control: copy (or rotate) the couple's secret album link that unlocks their share manager. */
export default function CoupleLink({ albumSlug }: { albumSlug: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState("");

  const fetchLink = async (rotate: boolean) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/share/admin/couple-key/${encodeURIComponent(albumSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const data = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!res.ok || !data.key) throw new Error(data.error ?? `Eroare ${res.status}`);
      const next = `${remoteAddress}${coupleLinkPath(albumSlug, data.key)}`;
      setUrl(next);
      try {
        await navigator.clipboard.writeText(next);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch { /* shown below for manual copy */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la generarea linkului.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="text-xs" onClick={event => event.stopPropagation()}>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} className="text-rose-200 hover:text-rose-100 disabled:opacity-50" onClick={() => void fetchLink(false)}>
        {busy ? "Se generează…" : copied ? "✓ Link miri copiat" : "💍 Copiază link pentru miri"}
      </button>
      {url && (confirmRotate ? (
        <span className="flex items-center gap-2">
          <span className="text-amber-200">Linkul vechi nu va mai funcționa.</span>
          <button type="button" className="text-red-300 underline underline-offset-4" onClick={() => { setConfirmRotate(false); void fetchLink(true); }}>Regenerează</button>
          <button type="button" className="text-neutral-500" onClick={() => setConfirmRotate(false)}>Anulează</button>
        </span>
      ) : (
        <button type="button" className="text-neutral-500 hover:text-white underline underline-offset-4" onClick={() => setConfirmRotate(true)}>Regenerează</button>
      ))}
    </div>
    {url && <p className="mt-1 break-all font-mono text-neutral-500">{url}</p>}
    {url && <p className="mt-1 text-neutral-500">Trimite-l DOAR mirilor: deschide albumul cu „💌 Pozele trimise de voi”.</p>}
    {error && <p role="alert" className="mt-2 text-amber-200 break-all">{error}</p>}
  </div>;
}
