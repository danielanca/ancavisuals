import React, { useState } from "react";
import { feedbackPath } from "../../../shared/feedback/feedback";
import { remoteAddress } from "../../utils/address";

export default function FeedbackLink({ albumSlug }: { albumSlug: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = `${remoteAddress}${feedbackPath(albumSlug)}`;
  async function copy() {
    setError("");
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setError(`Copiază manual linkul: ${url}`); }
  }
  return <div className="text-xs">
    <div className="flex flex-wrap items-center gap-3">
      <a href={feedbackPath(albumSlug)} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="text-amber-200 hover:text-amber-100">→ Pagina de feedback</a>
      <button type="button" className="text-neutral-300 hover:text-white underline underline-offset-4" onClick={event => { event.stopPropagation(); void copy(); }}>{copied ? "Link copiat" : "Copiază link feedback"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-amber-200 break-all">{error}</p>}
  </div>;
}
