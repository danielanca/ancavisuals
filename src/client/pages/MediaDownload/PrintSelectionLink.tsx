import { useState } from "react";
import { remoteAddress } from "../../utils/address";
import { printSelectionPath } from "./PrintSelectionGuide";

export default function PrintSelectionLink({ albumSlug }: { albumSlug: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const path = printSelectionPath(albumSlug);
  const url = `${remoteAddress}${path}`;
  return <div className="text-xs">
    <div className="flex flex-wrap items-center gap-3">
      <a href={path} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="text-amber-200 hover:text-amber-100">→ Invitație alegere 100 de poze</a>
      <button type="button" className="text-neutral-300 hover:text-white underline underline-offset-4" onClick={async event => {
        event.stopPropagation();
        setError("");
        try { await navigator.clipboard.writeText(url); setCopied(true); }
        catch { setError(`Copiază manual linkul: ${url}`); }
      }}>{copied ? "Link copiat" : "Copiază link alegere 100 de poze"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-amber-200 break-all">{error}</p>}
  </div>;
}
