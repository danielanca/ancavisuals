import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

interface ServiceItem {
  label: string;
  price: number;
}

interface ContractData {
  id: string;
  status: string;
  eventType: string;
  eventDate: string;
  eventLocation?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventDetails?: string;
  services: ServiceItem[];
  currency: string;
  priceTotal: number;
  priceAdvance: number;
  advancePaidAt?: string;
  priceRest: number;
  restPaidAt?: string;
  paymentMethod: string;
  bankBeneficiaryName?: string;
  bankIban?: string;
}

type PageState = "loading" | "ready" | "signed" | "expired" | "not_found" | "error" | "success";

const ContractSignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [contract, setContract] = useState<ContractData | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientIdSeries, setClientIdSeries] = useState("");
  const [dataSaved, setDataSaved] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [backupDetailsOpen, setBackupDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasSignature = useRef(false);

  useEffect(() => {
    if (!token) { setPageState("not_found"); return; }

    fetch(`/api/contracts/sign/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 410) {
          if (data.status === "signed") { if (data.pdfUrl) setSignedPdfUrl(data.pdfUrl); setPageState("signed"); }
          else { setPageState("expired"); }
          return;
        }
        if (res.status === 404) { setPageState("not_found"); return; }
        if (!res.ok) { setPageState("error"); return; }
        setContract(data);
        if (data.clientName) setClientName(data.clientName);
        if (data.clientEmail) setClientEmail(data.clientEmail);
        if (data.clientPhone) setClientPhone(data.clientPhone);
        if (data.clientAddress) setClientAddress(data.clientAddress);
        if (data.clientIdSeries) setClientIdSeries(data.clientIdSeries);
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

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!clientName.trim()) errors.clientName = "Numele complet este obligatoriu.";
    if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) errors.clientEmail = "Emailul este obligatoriu și trebuie să fie valid.";
    if (!clientIdSeries.trim()) {
      errors.clientIdSeries = "Seria și numărul buletinului sunt obligatorii.";
    } else if (!/^[A-Z]{2}[0-9]{6,7}$/.test(clientIdSeries.trim())) {
      errors.clientIdSeries = "Format incorect. Exemplu: AB123456";
    }
    if (!hasSignature.current) errors.signature = "Semnătura este obligatorie.";
    if (!agreed) errors.agreed = "Trebuie să fiți de acord cu contractul.";
    if (!gdprAccepted) errors.gdpr = "Acordul GDPR este obligatoriu.";
    if (!backupAcknowledged) errors.backup = "Trebuie să confirmați că ați luat la cunoștință obligația de back-up.";
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
      const res = await fetch(`/api/contracts/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientAddress: clientAddress.trim(),
          clientPhone: clientPhone.trim(),
          clientIdSeries: clientIdSeries.trim(),
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

  // --- State pages ---
  if (pageState === "loading") {
    return (
      <div style={pg.fullCenter}>
        <div style={pg.spinner} />
        <p style={{ color: "#999", marginTop: 16, fontSize: 14 }}>Se încarcă contractul...</p>
      </div>
    );
  }

  if (pageState === "signed") return (
    <div style={pg.fullCenter}>
      <div style={pg.iconBig}>✓</div>
      <h2 style={pg.stateH2}>Contract semnat</h2>
      <p style={pg.stateP}>Contractul a fost deja semnat. Veți primi o copie PDF pe email.</p>
      {signedPdfUrl && (
        <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" style={{
          marginTop: 24,
          display: "inline-block",
          padding: "12px 28px",
          background: "#c9a96e",
          color: "#fff",
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          letterSpacing: 1,
        }}>
          Descarcă Contractul PDF
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
      <p style={pg.stateP}>Contractul nu a putut fi găsit. Verificați link-ul sau contactați Anca Visuals.</p>
      <a href="mailto:ancadaniel1994@gmail.com" style={pg.link}>ancadaniel1994@gmail.com</a>
    </div>
  );

  if (pageState === "success") return (
    <div style={pg.fullCenter}>
      <div style={{ ...pg.iconBig, color: "#c9a96e" }}>✓</div>
      <h2 style={{ ...pg.stateH2, fontSize: 22 }}>Contract semnat cu succes!</h2>
      <p style={{ ...pg.stateP, maxWidth: 400 }}>
        Mulțumim! Contractul a fost semnat și veți primi în scurt timp o copie PDF pe email.
      </p>
      <p style={{ color: "#c9a96e", fontWeight: 600, marginTop: 20, fontSize: 15 }}>
        Anca Visuals — abia așteptăm evenimentul vostru!
      </p>
    </div>
  );

  if (!contract) return null;

  const currency = contract.currency || "RON";

  return (
    <div style={pg.page}>
      <div style={pg.container}>

        {/* HEADER */}
        <div style={pg.header}>
          <div style={pg.logoText}>ANCA VISUALS</div>
          <div style={pg.logoSub}>Fotografie & Videografie</div>
          <h1 style={pg.pageTitle}>Contract de Prestări Servicii Foto-Video</h1>
        </div>

        {/* PRESTATOR (fix) */}
        <Section title="Prestator">
          <InfoRow label="Denumire" value="ANCA DANIEL EMANUEL PFA" />
          <InfoRow label="CUI" value="45044473" />
          <InfoRow label="Adresă" value="Turda, jud. Cluj, Str. Plopilor, Nr. 3, bl. L1, sc. C, ap. 26" />
          <InfoRow label="Telefon" value="0745-469-907" />
          <InfoRow label="Email" value="ancadaniel1994@gmail.com" />
        </Section>

        {/* EVENIMENT */}
        <Section title="Eveniment">
          {contract.eventType && <InfoRow label="Tip" value={contract.eventType} />}
          <InfoRow label="Data" value={fmtDate(contract.eventDate)} bold />
          {(contract.eventStartTime || contract.eventEndTime) && (
            <InfoRow label="Interval orar" value={`${contract.eventStartTime ?? ""} – ${contract.eventEndTime ?? ""}`} />
          )}
          {contract.eventLocation && <InfoRow label="Locație" value={contract.eventLocation} />}
          {contract.eventDetails && <InfoRow label="Detalii" value={contract.eventDetails} />}
        </Section>

        {/* SERVICII */}
        {contract.services?.length > 0 && (
          <Section title="Servicii incluse">
            <div style={{ marginBottom: 10 }}>
              {contract.services.map((s, i) => (
                <div key={i} style={pg.serviceRow}>
                  <span style={pg.serviceCheck}>☑</span>
                  <span style={{ flex: 1 }}>{s.label}</span>
                  {s.price > 0 && <span style={pg.servicePrice}>{s.price} {currency}</span>}
                </div>
              ))}
            </div>
            {/* Payment overview */}
            <div style={pg.paymentBox}>
              <div style={pg.paymentBoxTitle}>Rezumat plăți</div>

              <div style={pg.paymentRow}>
                <div>
                  <div style={{ fontWeight: 600, color: "#1a1a1a" }}>Total contract</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a1a" }}>
                  {contract.priceTotal} {currency}
                </div>
              </div>

              <div style={{ ...pg.paymentRow, background: "#f0faf3", borderRadius: 6, margin: "6px 0", padding: "10px 12px" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "#2e7d32" }}>
                    De plătit acum <span style={{ fontWeight: 400 }}>(avans)</span>
                  </div>
                  {contract.advancePaidAt && (
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                      Scadent: {contract.advancePaidAt}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, color: "#2e7d32", fontSize: 15 }}>
                  {contract.priceAdvance} {currency}
                </div>
              </div>

              <div style={pg.paymentRow}>
                <div>
                  <div style={{ fontWeight: 600, color: "#444" }}>
                    Rest de plătit <span style={{ fontWeight: 400, color: "#888" }}>(la/după eveniment)</span>
                  </div>
                  {contract.restPaidAt && (
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                      Scadent: {contract.restPaidAt}
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 700, color: "#444", fontSize: 15 }}>
                  {contract.priceRest} {currency}
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#aaa", marginTop: 8, paddingTop: 8, borderTop: "1px solid #eee" }}>
                Metodă de plată: {contract.paymentMethod}
              </div>
              {contract.paymentMethod === "Transfer bancar" && (contract.bankBeneficiaryName || contract.bankIban) && (
                <div style={{ fontSize: 11, color: "#666", marginTop: 8, lineHeight: 1.6 }}>
                  Beneficiar: {contract.bankBeneficiaryName || "—"}
                  <br />
                  IBAN: {contract.bankIban || "—"}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* DATE CLIENT */}
        <form onSubmit={handleSubmit}>
          <Section title="Datele Dumneavoastră (Beneficiar)">
            <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
              Completați datele de mai jos, apoi apăsați <strong>Salvează datele</strong> pentru a le vedea incluse în contract.
            </p>
            <Field label="Nume și prenume *" error={fieldErrors.clientName}>
              <input style={{ ...pg.input, ...(fieldErrors.clientName ? pg.inputErr : {}) }}
                type="text" value={clientName} onChange={(e) => { setClientName(e.target.value); setDataSaved(false); }}
                placeholder="Ex: Popescu Ion" autoComplete="name" />
            </Field>
            <Field label="Email *" error={fieldErrors.clientEmail}>
              <input style={{ ...pg.input, ...(fieldErrors.clientEmail ? pg.inputErr : {}) }}
                type="email" value={clientEmail} onChange={(e) => { setClientEmail(e.target.value); setDataSaved(false); }}
                placeholder="Ex: maria@email.com" autoComplete="email" />
            </Field>
            <Field label="Adresă domiciliu" error={undefined}>
              <input style={pg.input} type="text" value={clientAddress}
                onChange={(e) => { setClientAddress(e.target.value); setDataSaved(false); }}
                placeholder="Str. Exemplu nr. 1, Oraș, Județ" autoComplete="street-address" />
            </Field>
            <Field label="Telefon" error={undefined}>
              <input style={pg.input} type="tel" value={clientPhone}
                onChange={(e) => { setClientPhone(e.target.value); setDataSaved(false); }}
                placeholder="07xxxxxxxx" autoComplete="tel" />
            </Field>
            <Field label="Serie și nr. buletin *" error={fieldErrors.clientIdSeries}>
              <input style={{ ...pg.input, ...(fieldErrors.clientIdSeries ? pg.inputErr : {}) }}
                type="text" value={clientIdSeries}
                onChange={(e) => { setClientIdSeries(e.target.value.toUpperCase()); setDataSaved(false); }}
                placeholder="Ex: AB123456" maxLength={9} />
              <span style={pg.hint}>2 litere urmate de 6-7 cifre, fără spații (ex: AB123456)</span>
            </Field>
            <button
              type="button"
              onClick={() => {
                setDataSaved(true);
              }}
              style={pg.saveBtn}
            >
              Salvează datele
            </button>
          </Section>

          {/* BUTON VEZI CONTRACTUL */}
          <div style={{ borderBottom: "1px solid #f0ede8", padding: "18px 28px" }}>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  clientName: clientName.trim(),
                  clientAddress: clientAddress.trim(),
                  clientPhone: clientPhone.trim(),
                  clientIdSeries: clientIdSeries.trim(),
                });
                window.open(`/api/contracts/sign/${token}/html?${params.toString()}`, "_blank");
              }}
              style={pg.pdfBtn}
            >
              📄 Vezi contractul complet
            </button>
            <p style={{ fontSize: 11, color: "#aaa", marginTop: 8, textAlign: "center" }}>
              Se deschide într-un tab nou — reveniți aici după ce ați citit contractul.
            </p>
          </div>

          {/* SIGNATURE */}
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

          <div style={pg.agreeRow}>
            <input type="checkbox" id="gdpr" checked={gdprAccepted} onChange={(e) => setGdprAccepted(e.target.checked)}
              style={{ width: 16, height: 16, marginRight: 10, cursor: "pointer", accentColor: "#c9a96e" }} />
            <label htmlFor="gdpr" style={pg.agreeLabel}>
              Sunt de acord cu prelucrarea datelor mele personale (nume, adresă, serie CI, semnătură) în scopul încheierii acestui contract, conform GDPR (Reg. UE 2016/679).
            </label>
          </div>
          {fieldErrors.gdpr && <p style={{ ...pg.errText, padding: "0 28px 8px" }}>{fieldErrors.gdpr}</p>}

          <div style={{ ...pg.agreeRow, paddingTop: 10 }}>
            <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: 16, height: 16, marginRight: 10, cursor: "pointer", accentColor: "#c9a96e" }} />
            <label htmlFor="agree" style={pg.agreeLabel}>
              Am citit contractul în întregime și sunt de acord cu toate clauzele și condițiile prezentate.
            </label>
          </div>
          {fieldErrors.agreed && <p style={{ ...pg.errText, padding: "0 28px 8px" }}>{fieldErrors.agreed}</p>}

          {/* NOTA BACKUP */}
          <div style={{ padding: "16px 28px 8px" }}>
            <div style={{ background: "#fffbf0", border: "1.5px solid #e8c840", borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a", marginBottom: 5 }}>
                    Important: salvați-vă materialele după primire!
                  </p>
                  <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: 0 }}>
                    Vă predăm pozele și videoclipurile pe link online sau pe stick USB. <strong>După ce le primiți, trebuie să le copiați și pe un dispozitiv al vostru</strong> (calculator, hard disk extern, stick propriu etc.) — noi nu putem garanta că fișierele vor rămâne disponibile oricând în viitor.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBackupDetailsOpen(!backupDetailsOpen)}
                style={{ fontSize: 12, color: "#c9a96e", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", letterSpacing: 0.3 }}
              >
                {backupDetailsOpen ? "Ascunde detalii ▲" : "Detalii aici ▼"}
              </button>

              {backupDetailsOpen && (
                <div style={{ marginTop: 12, padding: "14px 16px", background: "#fff", borderRadius: 6, border: "1px solid #f0e8c0", fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p style={{ fontWeight: 700, marginBottom: 10, color: "#1a1a1a" }}>Pe înțelesul tuturor — ce trebuie să faceți:</p>

                  <p style={{ marginBottom: 6 }}><strong>Unde primiți materialele de la noi:</strong><br />
                  Pe un link online (trimis pe email sau WhatsApp) sau direct pe un stick USB. Linkul online poate expira după un timp — deci nu vă bazați că va fi acolo mereu.</p>

                  <p style={{ marginBottom: 6 }}><strong>Ce înseamnă să faceți o copie de rezervă:</strong><br />
                  Să descărcați pozele și videoclipurile și să le salvați undeva al vostru, separat de linkul de unde le-ați primit. De exemplu:</p>
                  <ul style={{ margin: "4px 0 10px 20px" }}>
                    <li>Pe <strong>calculatorul sau laptop-ul de acasă</strong></li>
                    <li>Pe un <strong>hard disk extern</strong> (se găsesc în orice magazin de electronice, de la ~150–200 lei)</li>
                    <li>Pe un <strong>stick USB propriu</strong> <span style={{ color: "#e57c00", fontWeight: 600 }}>— atenție:</span> stick-urile USB durează în medie <strong>5–10 ani</strong> și se pot defecta oricând, fără avertisment. Un stick vechi sau căzut poate să nu mai citească nimic de pe el. Nu vă bazați <em>doar</em> pe stick.</li>
                    <li>Pe <strong>Google Photos</strong> sau <strong>iCloud</strong> — sunt servicii gratuite prin care vă puteți salva pozele și videoclipurile pe internet, accesibile oricând de pe telefon sau calculator (le găsiți deja instalate sau le descărcați gratuit)</li>
                  </ul>

                  <p style={{ color: "#c9a96e", fontWeight: 700, marginBottom: 4 }}>Recomandarea noastră:</p>
                  <p style={{ marginBottom: 8 }}>Salvați în cel puțin <strong>2 locuri diferite</strong>. De exemplu, pe calculator ȘI pe Google Photos. Dacă un dispozitiv se strică, aveți copia în celălalt loc.</p>

                  <p style={{ color: "#999", fontSize: 12, borderTop: "1px solid #f0e8c0", paddingTop: 10, marginTop: 4 }}>
                    Pozele de la eveniment nu pot fi refăcute. Tratați-le ca pe niște amintiri de neînlocuit și asigurați-vă că le puneți în siguranță imediat după ce le primiți.
                  </p>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 14 }}>
                <input type="checkbox" id="backup" checked={backupAcknowledged}
                  onChange={(e) => setBackupAcknowledged(e.target.checked)}
                  style={{ width: 16, height: 16, marginTop: 2, cursor: "pointer", accentColor: "#c9a96e", flexShrink: 0 }} />
                <label htmlFor="backup" style={{ fontSize: 13, color: "#444", lineHeight: 1.5, cursor: "pointer" }}>
                  Am înțeles că, după primirea materialelor (poze și/sau videoclipuri), este responsabilitatea mea să le copiez și pe un dispozitiv propriu. Anca Visuals nu răspunde pentru pierderea sau indisponibilitatea fișierelor după predarea lor.
                </label>
              </div>
              {fieldErrors.backup && <p style={{ ...pg.errText, marginTop: 6 }}>{fieldErrors.backup}</p>}
            </div>
          </div>

          {fieldErrors.submit && <p style={{ ...pg.errText, textAlign: "center", padding: "0 28px 12px" }}>{fieldErrors.submit}</p>}

          <div style={{ padding: "8px 28px 32px" }}>
            <button type="submit" disabled={submitting}
              style={{ ...pg.submitBtn, ...(submitting ? pg.submitDisabled : {}) }}>
              {submitting ? "Se procesează..." : "SEMNEZ CONTRACTUL"}
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
    <span style={{ fontSize: 12, color: "#888", minWidth: 120, flexShrink: 0 }}>{label}</span>
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
  serviceRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#333", padding: "4px 0", borderBottom: "1px solid #f5f2ee" },
  serviceCheck: { fontSize: 15, color: "#c9a96e" },
  servicePrice: { fontSize: 12, color: "#666", flexShrink: 0 },
  paymentBox: { border: "1px solid #e8e4de", borderRadius: 8, overflow: "hidden", marginTop: 4 },
  paymentBoxTitle: { background: "#f7f4f0", padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase" as const, letterSpacing: 1.5 },
  paymentRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderTop: "1px solid #f0ede8" },
  input: { width: "100%", padding: "10px 13px", fontSize: 14, border: "1px solid #ddd", borderRadius: 6, color: "#1a1a1a", background: "#fafafa", boxSizing: "border-box", outline: "none" },
  inputErr: { borderColor: "#e53935", background: "#fff5f5" },
  hint: { display: "block", fontSize: 11, color: "#aaa", marginTop: 4 },
  errText: { display: "block", fontSize: 12, color: "#e53935", marginTop: 4 },
  signHelp: { fontSize: 12, color: "#888", marginBottom: 10 },
  canvas: { width: "100%", height: 180, border: "1.5px solid #ddd", borderRadius: 6, background: "#fff", cursor: "crosshair", display: "block", touchAction: "none" },
  canvasErr: { borderColor: "#e53935" },
  clearBtn: { marginTop: 8, padding: "5px 12px", fontSize: 12, color: "#888", background: "transparent", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" },
  agreeRow: { display: "flex", alignItems: "flex-start", padding: "18px 28px 8px" },
  agreeLabel: { fontSize: 13, color: "#444", lineHeight: 1.5, cursor: "pointer" },
  submitBtn: { display: "block", width: "100%", padding: 16, background: "#c9a96e", color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", border: "none", borderRadius: 6, cursor: "pointer" },
  submitDisabled: { background: "#e0d5c3", cursor: "not-allowed" },
  saveBtn: { marginTop: 4, padding: "10px 20px", background: "#1a1a1a", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", letterSpacing: 0.5 },
  pdfBtn: { display: "block", width: "100%", padding: "14px 20px", background: "#c9a96e", color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, border: "none", borderRadius: 6, cursor: "pointer" },
  footer: { textAlign: "center", padding: "14px", fontSize: 11, color: "#bbb", borderTop: "1px solid #f0ede8" },
  fullCenter: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#f9f7f4" },
  iconBig: { fontSize: 52, marginBottom: 14 },
  stateH2: { color: "#1a1a1a", fontWeight: 700, fontSize: 20, marginBottom: 8 },
  stateP: { color: "#666", textAlign: "center", maxWidth: 380, lineHeight: 1.6 },
  link: { marginTop: 16, color: "#c9a96e", fontSize: 14, textDecoration: "none" },
  spinner: { width: 36, height: 36, border: "3px solid #e0d5c3", borderTop: "3px solid #c9a96e", borderRadius: "50%" },
};

export default ContractSignPage;
