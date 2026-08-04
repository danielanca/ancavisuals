import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

interface HandoverData {
  id: string;
  status: string;
  eventType: string;
  eventDate: string;
  clientEmail: string;
  clientName?: string;
  includeDigitalLink?: boolean;
  includeCourier?: boolean;
  includePersonalHandover?: boolean;
  digitalLinks?: { label: string }[];
  courierDeliveryDays: number;
  materialsReportWindowDays: number;
  digitalLinkExpiryDays: number;
  awb?: string;
}

type PageState = "loading" | "ready" | "signed" | "expired" | "not_found" | "error" | "success";

const HandoverSignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [handover, setHandover] = useState<HandoverData | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [digitalLinkAcknowledged, setDigitalLinkAcknowledged] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [backupDetailsOpen, setBackupDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasSignature = useRef(false);

  useEffect(() => {
    if (!token) { setPageState("not_found"); return; }

    fetch(`/api/handover/sign/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 410) {
          if (data.status === "signed") { if (data.pdfUrl) setSignedPdfUrl(data.pdfUrl); setPageState("signed"); }
          else { setPageState("expired"); }
          return;
        }
        if (res.status === 404) { setPageState("not_found"); return; }
        if (!res.ok) { setPageState("error"); return; }
        setHandover(data);
        if (data.clientName) setClientName(data.clientName);
        setPageState("ready");
      })
      .catch(() => setPageState("error"));
  }, [token]);

  useEffect(() => {
    if (pageState !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const getPos = (e: MouseEvent | Touch, rect: DOMRect) => ({
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    });

    const onDown = (e: MouseEvent) => { isDrawing.current = true; lastPos.current = getPos(e, canvas.getBoundingClientRect()); };
    const onMove = (e: MouseEvent) => {
      if (!isDrawing.current) return;
      const pos = getPos(e, canvas.getBoundingClientRect());
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      lastPos.current = pos; hasSignature.current = true;
    };
    const onUp = () => { isDrawing.current = false; };

    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e.touches[0], canvas.getBoundingClientRect()); };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const pos = getPos(e.touches[0], canvas.getBoundingClientRect());
      ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      lastPos.current = pos; hasSignature.current = true;
    };
    const onTouchEnd = () => { isDrawing.current = false; };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [pageState]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasSignature.current = false;
  };

  const requiresDigitalLinkAck = handover?.includeDigitalLink !== false;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!clientName.trim()) errors.clientName = "Numele complet este obligatoriu.";
    if (requiresDigitalLinkAck && !digitalLinkAcknowledged) errors.digitalLinkAcknowledged = "Trebuie să confirmați că ați înțeles că veți primi link-ul digital pe email după semnare.";
    if (!backupAcknowledged) errors.backupAcknowledged = "Trebuie să confirmați că veți salva materialele pe un mediu de stocare separat.";
    if (!termsAcknowledged) errors.termsAcknowledged = "Trebuie să confirmați că ați înțeles termenele de mai jos.";
    if (!hasSignature.current) errors.signature = "Semnătura este obligatorie.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/handover/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          digitalLinkAcknowledged,
          backupAcknowledged,
          termsAcknowledged,
          clientSignatureBase64: canvas.toDataURL("image/png"),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) { setPageState(data.status === "signed" ? "signed" : "expired"); return; }
        setFieldErrors({ submit: data.error ?? "Eroare la semnare. Încercați din nou." });
        return;
      }
      setPageState("success");
    } catch {
      setFieldErrors({ submit: "Eroare de rețea. Verificați conexiunea și încercați din nou." });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
  };

  if (pageState === "loading") {
    return (
      <div style={pg.fullCenter}>
        <div style={pg.spinner} />
        <p style={{ color: "#999", marginTop: 16, fontSize: 14 }}>Se încarcă procesul verbal...</p>
      </div>
    );
  }

  if (pageState === "signed") return (
    <div style={pg.fullCenter}>
      <div style={pg.iconBig}>✓</div>
      <h2 style={pg.stateH2}>Proces verbal semnat</h2>
      <p style={pg.stateP}>Acest document a fost deja semnat. Veți primi o copie PDF pe email.</p>
      {signedPdfUrl && (
        <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" style={pg.pdfLink}>
          Descarcă PDF-ul
        </a>
      )}
    </div>
  );

  if (pageState === "expired") return (
    <div style={pg.fullCenter}>
      <div style={pg.iconBig}>⏱</div>
      <h2 style={pg.stateH2}>Link expirat</h2>
      <p style={pg.stateP}>Link-ul de semnare a expirat. Contactați Anca Visuals pentru un link nou.</p>
      <a href="mailto:ancadaniel1994@gmail.com" style={pg.link}>ancadaniel1994@gmail.com</a>
    </div>
  );

  if (pageState === "not_found" || pageState === "error") return (
    <div style={pg.fullCenter}>
      <div style={pg.iconBig}>✕</div>
      <h2 style={pg.stateH2}>Link invalid</h2>
      <p style={pg.stateP}>Documentul nu a putut fi găsit. Verificați link-ul sau contactați Anca Visuals.</p>
      <a href="mailto:ancadaniel1994@gmail.com" style={pg.link}>ancadaniel1994@gmail.com</a>
    </div>
  );

  if (pageState === "success") return (
    <div style={pg.fullCenter}>
      <div style={{ ...pg.iconBig, color: "#c9a96e" }}>✓</div>
      <h2 style={{ ...pg.stateH2, fontSize: 22 }}>Proces verbal semnat cu succes!</h2>
      <p style={{ ...pg.stateP, maxWidth: 400 }}>
        Mulțumim! Veți primi în scurt timp pe email link-ul de descărcare a materialelor, împreună cu o copie PDF a procesului verbal.
      </p>
      <p style={{ color: "#c9a96e", fontWeight: 600, marginTop: 20, fontSize: 15 }}>
        Anca Visuals — abia așteptăm ca materialele să ajungă la voi!
      </p>
    </div>
  );

  if (!handover) return null;

  const courierDeliveryDays = handover.courierDeliveryDays || 7;
  const materialsReportWindowDays = handover.materialsReportWindowDays || 7;
  const digitalLinkExpiryDays = handover.digitalLinkExpiryDays || 30;
  const includeDigitalLink = handover.includeDigitalLink !== false;
  const includeCourier = handover.includeCourier !== false;
  const includePersonalHandover = Boolean(handover.includePersonalHandover);

  return (
    <div style={pg.page}>
      <div style={pg.container}>

        <div style={pg.header}>
          <div style={pg.logoText}>ANCA VISUALS</div>
          <div style={pg.logoSub}>Fotografie & Videografie</div>
          <h1 style={pg.pageTitle}>Proces Verbal de Predare-Primire a Materialelor</h1>
        </div>

        <Section title="Eveniment">
          <InfoRow label="Tip" value={handover.eventType} />
          <InfoRow label="Data" value={fmtDate(handover.eventDate)} bold />
          <InfoRow label="Client" value={handover.clientEmail} />
        </Section>

        <Section title="Declarație">
          <ol style={pg.declList}>
            {includeDigitalLink && (
              <li style={pg.declItem}>
                Am fost informat(ă) și sunt de acord că linkul de acces digital către materialele foto/video rezultate în urma evenimentului îmi va fi trimis pe adresa de email indicată <strong>imediat după semnarea prezentului document</strong>, nu înainte.
                {handover.digitalLinks && handover.digitalLinks.length > 0 && (
                  <> Materialele digitale predate includ: <strong>{handover.digitalLinks.map((l) => l.label).join(", ")}</strong>.</>
                )}
                {" "}Înțeleg că acest link este valabil timp de <strong>{digitalLinkExpiryDays} zile</strong> calendaristice de la data prezentei semnături, termen în care am obligația de a descărca și salva materialele pe un dispozitiv propriu.
              </li>
            )}
            {includeCourier && (
              <li style={pg.declItem}>
                Am luat la cunoștință faptul că materialele fizice (albumul și/sau alte suporturi), aferente pachetului contractat, urmează să fie livrate prin curier în termen de maximum <strong>{courierDeliveryDays} zile</strong> calendaristice de la data prezentei semnături.
                {handover.awb && (
                  <> Coletul are numărul de tracking (AWB) <strong>{handover.awb}</strong>, pe baza căruia pot urmări statusul livrării pe site-ul curierului.</>
                )}
              </li>
            )}
            {includePersonalHandover && (
              <li style={pg.declItem}>
                Confirm că am primit personal, direct de la Anca Visuals, materialele fizice (albumul și/sau alte suporturi) aferente pachetului contractat, la data prezentei semnături.
              </li>
            )}
            {(includeCourier || includePersonalHandover) && (
              <li style={pg.declItem}>
                Înțeleg că, de la data {includeCourier ? "recepționării efective a coletului cu materialele fizice" : "predării materialelor fizice, conform prezentului document"}, am la dispoziție un termen de <strong>{materialsReportWindowDays} zile</strong> calendaristice pentru a verifica integritatea acestora și a semnala în scris eventuale neconformități, deteriorări sau lipsuri constatate. În lipsa unei sesizări în acest interval, materialele fizice se consideră acceptate ca fiind conforme.
              </li>
            )}
            <li style={pg.declItem}>
              Am fost informat(ă) că suporturile de stocare portabile (stick USB, card de memorie, hard disk extern) se pot defecta sau pot pierde datele stocate, de regulă după aproximativ <strong>3–4 ani</strong> de utilizare, fără avertisment prealabil. Prin urmare, îmi asum obligația de a realiza copii de rezervă (back-up) ale tuturor materialelor primite, în cel puțin <strong>două locații diferite</strong> (de exemplu: calculator personal, hard disk extern, serviciu de stocare în cloud). Anca Visuals nu poate fi trasă la răspundere pentru pierderea sau deteriorarea materialelor după predarea acestora.
            </li>
          </ol>
        </Section>

        <div style={{ padding: "0 28px 18px" }}>
          <div style={pg.backupNote}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={pg.backupNoteTitle}>Important: salvați-vă materialele imediat după primire!</p>
                <p style={pg.backupNoteText}>
                  Stick-urile USB și alte suporturi portabile <strong>durează în medie 3–4 ani</strong> și se pot defecta oricând, fără avertisment. Nu vă bazați doar pe un singur suport.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBackupDetailsOpen(!backupDetailsOpen)}
              style={pg.backupToggle}
            >
              {backupDetailsOpen ? "Ascunde detalii ▲" : "Detalii aici ▼"}
            </button>

            {backupDetailsOpen && (
              <div style={pg.backupDetails}>
                <p style={{ marginBottom: 6 }}><strong>Ce înseamnă să faceți o copie de rezervă:</strong><br />
                Să salvați materialele primite în cel puțin două locuri diferite, separate de suportul pe care le-ați primit inițial. De exemplu:</p>
                <ul style={{ margin: "4px 0 10px 20px" }}>
                  <li>Pe <strong>calculatorul sau laptop-ul de acasă</strong></li>
                  <li>Pe un <strong>hard disk extern</strong></li>
                  <li>Pe <strong>Google Photos</strong> sau <strong>iCloud</strong> — servicii gratuite de stocare accesibile oricând de pe telefon sau calculator</li>
                </ul>
                <p style={{ color: "#999", fontSize: 12, borderTop: "1px solid #f0e8c0", paddingTop: 10, marginTop: 4 }}>
                  Materialele de la eveniment nu pot fi refăcute. Tratați-le ca pe niște amintiri de neînlocuit.
                </p>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Section title="Datele Dumneavoastră">
            <Field label="Nume și prenume *" error={fieldErrors.clientName}>
              <input style={{ ...pg.input, ...(fieldErrors.clientName ? pg.inputErr : {}) }}
                type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Popescu Ion" autoComplete="name" />
            </Field>
          </Section>

          {includeDigitalLink && (
            <>
              <div style={pg.agreeRow}>
                <input type="checkbox" id="digitalLinkAcknowledged" checked={digitalLinkAcknowledged}
                  onChange={(e) => setDigitalLinkAcknowledged(e.target.checked)}
                  style={pg.checkbox} />
                <label htmlFor="digitalLinkAcknowledged" style={pg.agreeLabel}>
                  Am înțeles că voi primi link-ul digital cu materialele pe email, imediat după ce semnez acest document.
                </label>
              </div>
              {fieldErrors.digitalLinkAcknowledged && <p style={{ ...pg.errText, padding: "0 28px 8px" }}>{fieldErrors.digitalLinkAcknowledged}</p>}
            </>
          )}

          <div style={{ ...pg.agreeRow, paddingTop: 10 }}>
            <input type="checkbox" id="backupAcknowledged" checked={backupAcknowledged}
              onChange={(e) => setBackupAcknowledged(e.target.checked)}
              style={pg.checkbox} />
            <label htmlFor="backupAcknowledged" style={pg.agreeLabel}>
              Am luat la cunoștință să-mi salvez materialele primite pe un mediu de stocare diferit de cel pe care le-am primit (nu doar pe stick — ex: calculator, hard disk extern, cloud).
            </label>
          </div>
          {fieldErrors.backupAcknowledged && <p style={{ ...pg.errText, padding: "0 28px 8px" }}>{fieldErrors.backupAcknowledged}</p>}

          <div style={{ ...pg.agreeRow, paddingTop: 10 }}>
            <input type="checkbox" id="termsAcknowledged" checked={termsAcknowledged}
              onChange={(e) => setTermsAcknowledged(e.target.checked)}
              style={pg.checkbox} />
            <label htmlFor="termsAcknowledged" style={pg.agreeLabel}>
              Am înțeles și sunt de acord cu termenele și responsabilitățile de mai sus.
            </label>
          </div>
          {fieldErrors.termsAcknowledged && <p style={{ ...pg.errText, padding: "0 28px 8px" }}>{fieldErrors.termsAcknowledged}</p>}

          <Section title="Semnătura">
            <p style={pg.signHelp}>Semnați mai jos folosind mouse-ul sau degetul.</p>
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              style={{ ...pg.canvas, ...(fieldErrors.signature ? pg.canvasErr : {}) }}
            />
            {fieldErrors.signature && <span style={pg.errText}>{fieldErrors.signature}</span>}
            <button type="button" onClick={clearCanvas} style={pg.clearBtn}>Șterge semnătura</button>
          </Section>

          {fieldErrors.submit && <p style={{ ...pg.errText, textAlign: "center", padding: "0 28px 12px" }}>{fieldErrors.submit}</p>}

          <div style={{ padding: "8px 28px 32px" }}>
            <button type="submit" disabled={submitting}
              style={{ ...pg.submitBtn, ...(submitting ? pg.submitDisabled : {}) }}>
              {submitting ? "Se procesează..." : "SEMNEZ PROCESUL VERBAL"}
            </button>
          </div>
        </form>

        <div style={pg.footer}>
          Anca Visuals &nbsp;•&nbsp; ancadaniel1994@gmail.com &nbsp;•&nbsp; ancavisuals.ro
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ padding: "18px 28px", borderBottom: "1px solid #f0ede8" }}>
    <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#c9a96e", margin: "0 0 12px" }}>
      {title}
    </h3>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 6, alignItems: "flex-start" }}>
    <span style={{ fontSize: 12, color: "#888", minWidth: 80, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, color: "#333", flex: 1, fontWeight: bold ? 700 : 400 }}>{value}</span>
  </div>
);

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {label}
    </label>
    {children}
    {error && <span style={pg.errText}>{error}</span>}
  </div>
);

const pg: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f9f7f4", padding: "24px 16px 48px" },
  container: { maxWidth: 680, margin: "0 auto", background: "#fff", borderRadius: 8, boxShadow: "0 2px 20px rgba(0,0,0,0.08)", overflow: "hidden" },
  header: { textAlign: "center", padding: "32px 24px 24px", borderBottom: "2px solid #c9a96e" },
  logoText: { fontSize: 22, fontWeight: 300, letterSpacing: 4, color: "#c9a96e", fontFamily: "Georgia, serif" },
  logoSub: { fontSize: 10, color: "#bbb", letterSpacing: 2, textTransform: "uppercase", marginTop: 3, marginBottom: 14 },
  pageTitle: { fontSize: 14, fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 },
  declList: { margin: 0, paddingLeft: 20 },
  declItem: { fontSize: 13, color: "#333", lineHeight: 1.7, marginBottom: 10 },
  backupNote: { background: "#fffbf0", border: "1.5px solid #e8c840", borderRadius: 8, padding: "16px 18px" },
  backupNoteTitle: { fontWeight: 700, fontSize: 13, color: "#1a1a1a", marginBottom: 5 },
  backupNoteText: { fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0 },
  backupToggle: { fontSize: 12, color: "#c9a96e", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", letterSpacing: 0.3 },
  backupDetails: { marginTop: 12, padding: "14px 16px", background: "#fff", borderRadius: 6, border: "1px solid #f0e8c0", fontSize: 13, color: "#444", lineHeight: 1.7 },
  input: { width: "100%", padding: "10px 13px", fontSize: 14, border: "1px solid #ddd", borderRadius: 6, color: "#1a1a1a", background: "#fafafa", boxSizing: "border-box", outline: "none" },
  inputErr: { borderColor: "#e53935", background: "#fff5f5" },
  errText: { display: "block", fontSize: 12, color: "#e53935", marginTop: 4 },
  signHelp: { fontSize: 12, color: "#888", marginBottom: 10 },
  canvas: { width: "100%", height: 180, border: "1.5px solid #ddd", borderRadius: 6, background: "#fff", cursor: "crosshair", display: "block", touchAction: "none" },
  canvasErr: { borderColor: "#e53935" },
  clearBtn: { marginTop: 8, padding: "5px 12px", fontSize: 12, color: "#888", background: "transparent", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" },
  agreeRow: { display: "flex", alignItems: "flex-start", padding: "18px 28px 8px" },
  agreeLabel: { fontSize: 13, color: "#444", lineHeight: 1.5, cursor: "pointer" },
  checkbox: { width: 16, height: 16, marginTop: 2, marginRight: 10, cursor: "pointer", accentColor: "#c9a96e", flexShrink: 0 },
  submitBtn: { display: "block", width: "100%", padding: 16, background: "#c9a96e", color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", border: "none", borderRadius: 6, cursor: "pointer" },
  submitDisabled: { background: "#e0d5c3", cursor: "not-allowed" },
  footer: { textAlign: "center", padding: "14px", fontSize: 11, color: "#bbb", borderTop: "1px solid #f0ede8" },
  fullCenter: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#f9f7f4" },
  iconBig: { fontSize: 52, marginBottom: 14 },
  stateH2: { color: "#1a1a1a", fontWeight: 700, fontSize: 20, marginBottom: 8 },
  stateP: { color: "#666", textAlign: "center", maxWidth: 380, lineHeight: 1.6 },
  link: { marginTop: 16, color: "#c9a96e", fontSize: 14, textDecoration: "none" },
  pdfLink: { marginTop: 24, display: "inline-block", padding: "12px 28px", background: "#c9a96e", color: "#fff", borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: 1 },
  spinner: { width: 36, height: 36, border: "3px solid #e0d5c3", borderTop: "3px solid #c9a96e", borderRadius: "50%" },
};

export default HandoverSignPage;
