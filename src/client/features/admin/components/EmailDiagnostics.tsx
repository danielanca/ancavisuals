import React, { useCallback, useEffect, useState } from "react";

type Delivery = { id: string; to: string; subject: string; status: string; error?: string; createdAt: string; attempts: number };
const labels: Record<string, string> = { pending: "În curs", accepted: "Acceptat de SMTP", failed: "Eșuat", unknown: "Rezultat neconfirmat" };

export default function EmailDiagnostics({ accessToken, expanded }: { accessToken: string; expanded: boolean }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [recipient, setRecipient] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/admin/email-deliveries", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("Istoricul emailurilor nu este disponibil.");
      const data = await res.json();
      setDeliveries(data.deliveries); setRecipient(data.recipient); setTestMode(data.testMode); setLoadError("");
    } catch { setLoadError("Istoricul emailurilor nu este disponibil. Reîncearcă."); }
  }, [accessToken]);
  useEffect(() => { void reload(); const timer = setInterval(() => void reload(), 30000); return () => clearInterval(timer); }, [reload]);
  async function run(action: "verify" | "send") {
    setBusy(true); setResult("");
    try {
      const res = await fetch("/api/admin/email-diagnostic", { method: "POST", headers: {
        Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json",
      }, body: JSON.stringify({ action }) });
      const data = await res.json();
      setResult(data.error ?? data.message ?? "Rezultatul testului nu este disponibil.");
      await reload();
    } catch { setResult("Conexiunea cu aplicația s-a întrerupt. Verifică istoricul înainte să retrimiți."); }
    finally { setBusy(false); }
  }
  const failed = deliveries.filter(d => d.status === "failed" || d.status === "unknown" || (d.status === "pending" && Date.now() - Date.parse(d.createdAt) > 120000));
  return <div style={{ padding: "12px 18px", color: "#ddd", borderBottom: "1px solid #222", fontSize: 13 }}>
    {failed.length > 0 && <p role="alert" style={{ color: "#fca5a5" }}>{failed.length} emailuri eșuate sau neconfirmate în ultimele {deliveries.length} trimiteri. Deschide „Email” pentru detalii.</p>}
    {loadError && <p role="alert">{loadError}</p>}
    {expanded && <>
      <h3>Verificare email</h3>
      <p>Destinatar test: {recipient || "neconfigurat"}{testMode ? " · Transport de test activ" : ""}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <button disabled={busy} onClick={() => void run("verify")}>Verifică SMTP</button>
        <button disabled={busy || !recipient} onClick={() => void run("send")}>Trimite email de test</button>
        <button disabled={busy} onClick={() => void reload()}>Actualizează istoricul</button>
      </div>
      <p role="status">{busy ? "Verificare în curs…" : result}</p>
      <p>„Acceptat de SMTP” confirmă preluarea pentru expediere. Primirea se verifică în Inbox sau Spam. Un rezultat „În curs” rămas după restart necesită verificare; nu se retrimite automat.</p>
      <div style={{ maxHeight: 320, overflow: "auto" }}>
        {!deliveries.length && <p>Nu există trimiteri înregistrate încă.</p>}
        {deliveries.map(d => <div key={d.id} style={{ padding: "10px 0", borderTop: "1px solid #333", overflowWrap: "anywhere" }}>
          <strong>{labels[d.status] ?? d.status}</strong> · {d.attempts} încercări<br />
          {d.subject}<br />{d.to} · {new Date(d.createdAt).toLocaleString("ro-RO")}
          {d.error && <p style={{ color: "#fca5a5" }}>{d.error}</p>}
        </div>)}
      </div>
    </>}
  </div>;
}
