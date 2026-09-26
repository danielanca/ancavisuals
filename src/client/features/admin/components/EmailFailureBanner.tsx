import React, { useCallback, useEffect, useState } from "react";

type Alert = { id: string; occurredAt: string; error: string; subject: string; to: string; diagnostic?: string };
export default function EmailFailureBanner({ accessToken }: { accessToken: string }) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/admin/email-alert", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error();
      const data = await res.json(); setAlert(data.alert); setUnavailable(false);
    } catch { setUnavailable(true); }
  }, [accessToken]);
  useEffect(() => {
    void load(); const timer = setInterval(() => void load(), 15000);
    const onFocus = () => void load(); window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);
  async function acknowledge() {
    if (!alert) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-alert/acknowledge", { method: "POST", headers: {
        Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json",
      }, body: JSON.stringify({ id: alert.id }) });
      if (!res.ok) throw new Error();
      setFeedback(""); await load();
    } catch { setFeedback("Nu am putut confirma alerta. Reîncearcă."); }
    finally { setBusy(false); }
  }
  if (!alert && !unavailable) return null;
  const diagnostic = alert ? `AncaVisuals — eroare email\nData: ${alert.occurredAt}\nDestinatar: ${alert.to}\nSubiect: ${alert.subject}\n${alert.error}\n\n${alert.diagnostic ?? "Stack trace indisponibil."}` : "";
  return <section role="alert" style={{ background: "#7f1d1d", border: "4px solid #f87171", color: "#fff", padding: "clamp(18px, 4vw, 32px)", borderRadius: 16, marginBottom: 24, boxShadow: "0 0 28px #ef444455", overflowWrap: "anywhere" }}>
    <h2 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 900, lineHeight: 1.15, marginBottom: 16 }}>
      {alert ? "⚠ ALERTĂ EMAIL — O TRIMITERE A EȘUAT" : "⚠ NU PUTEM VERIFICA STAREA EMAILURILOR"}
    </h2>
    {alert ? <>
      <p style={{ fontSize: 20, fontWeight: 700 }}>ATENȚIE: un email nu a putut fi trimis sau confirmat. Destinatarul poate să nu fi primit mesajul!</p>
      <p style={{ marginTop: 12 }}>{alert.error}</p>
      <p>{new Date(alert.occurredAt).toLocaleString("ro-RO")} · {alert.to} · {alert.subject}</p>
      <p style={{ marginTop: 12 }}>Verifică „Activitate site → Email”. Confirmarea acestei alerte nu repară trimiterea. Un succes ulterior nu șterge automat alerta.</p>
      <details style={{ marginTop: 16 }}><summary>Detalii tehnice pentru diagnostic</summary>
        <pre style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", padding: 12, background: "#1c0808", fontSize: 12 }}>{diagnostic}</pre>
      </details>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
        <button style={{ background: "white", color: "#7f1d1d", padding: "12px 18px", borderRadius: 8, fontWeight: 700 }} onClick={async () => {
          try { await navigator.clipboard.writeText(diagnostic); setFeedback("Eroarea a fost copiată."); }
          catch { setFeedback("Copiază manual textul din detaliile tehnice."); }
        }}>Copiază eroarea</button>
        <button disabled={busy} style={{ border: "1px solid white", padding: "12px 18px", borderRadius: 8 }} onClick={() => void acknowledge()}>Am văzut alerta — ascunde</button>
      </div>
    </> : <p>Monitorizarea nu răspunde. Nu putem confirma dacă emailurile funcționează. Reîncearcă verificarea.</p>}
    {unavailable && alert && <p>Actualizarea stării nu este disponibilă; păstrăm ultima alertă cunoscută.</p>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
