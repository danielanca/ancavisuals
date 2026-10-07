import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../admin/auth/useAuth";

export default function CreateClientBriefLink({ eventId }: { eventId: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/client-briefs/admin/events/${encodeURIComponent(eventId)}`, {
        method: "POST", headers: { Authorization: `Bearer ${auth.auth.accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Brief-ul nu a putut fi creat.");
      navigate(`/admin/events/${encodeURIComponent(eventId)}/brief`);
    } catch (err) { setError(err instanceof Error ? err.message : "Eroare de conexiune."); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => void create()} className="text-xs text-amber-200 hover:text-amber-100 underline underline-offset-4 disabled:opacity-50">{busy ? "Se creează brief-ul…" : "Creează brief client"}</button>
    {error && <p role="alert" className="text-xs text-red-300 mt-2">{error}</p>}
  </div>;
}
