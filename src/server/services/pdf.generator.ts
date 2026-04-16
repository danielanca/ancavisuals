import puppeteer from "puppeteer";

// Datele prestatorului — fixe
const PRESTATOR = {
  name: "ANCA DANIEL EMANUEL PFA",
  cui: "45044473",
  address: "Turda, jud. Cluj, Str. Plopilor, Nr. 3, bl. L1, sc. C, ap. 26",
  phone: "0745-469-907",
  email: "ancadaniel1994@gmail.com",
  iban: "RO65 REVO 0000 3283 4355 4544",
  bank: "Revolut",
  representative: "ANCA DANIEL-EMANUEL",
};

export interface ContractService {
  label: string;
  price: number;
  gratuit?: boolean;
  isTransport?: boolean;
}

export async function generateContractPDF(contract: Record<string, unknown>): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildContractHTML(contract), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converteste Firestore Timestamp sau ISO string la string ISO, sau undefined */
function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  // Firestore Timestamp: { _seconds, _nanoseconds } sau { seconds, nanoseconds }
  if (typeof value === "object") {
    const ts = value as Record<string, unknown>;
    const secs = (ts._seconds ?? ts.seconds);
    if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  }
  return String(value);
}

function formatDate(value: unknown): string {
  const iso = toIsoString(value);
  if (!iso) return "___________";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "___________";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

function formatShortDate(value: unknown): string {
  const iso = toIsoString(value);
  if (!iso) return "___________";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "___________";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildContractHTML(contract: Record<string, unknown>): string {
  const signedDate = formatDate(contract.signedAt);
  const eventDateFormatted = formatDate(contract.eventDate);
  const contractDate = formatShortDate(contract.signedAt ?? contract.createdAt);

  const services = (contract.services as ContractService[]) ?? [];
  const priceTotal = Number(contract.priceTotal) || 0;
  const priceAdvance = Number(contract.priceAdvance) || 0;
  const priceRest = Number(contract.priceRest) || (priceTotal - priceAdvance);


  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.55; }
  h1 { font-size: 14pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .underline { text-decoration: underline; }
  .section { margin: 14px 0 6px; font-weight: 700; text-transform: uppercase; }
  .article { margin: 10px 0 4px; font-weight: 700; }
  p { margin: 4px 0; }
  table.services { width: 100%; border-collapse: collapse; margin: 6px 0; }
  table.services td { padding: 3px 6px; }
  table.services tr { border-bottom: 1px solid #eee; }
  .sig-row { display: flex; gap: 60px; margin-top: 40px; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 700; }
  .sig-name { font-size: 10pt; font-weight: 700; margin-top: 4px; }
  .sig-date { font-size: 9pt; color: #666; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 8pt; color: #999; text-align: center; }
  hr { border: none; border-top: 1px solid #999; margin: 8px 0; }
  .total-row td { font-weight: 700; font-size: 11pt; padding-top: 6px; }
</style>
</head>
<body>

<h1>Contract Prestări Servicii Foto-Video</h1>
<p class="center">Data: ${contractDate}</p>
<hr style="margin: 10px 0;" />

<p class="section">1. Părțile contractante:</p>

<p><span class="bold">PRESTATOR:</span> ${esc(PRESTATOR.name)}, CUI: ${esc(PRESTATOR.cui)}, cu domiciliul în ${esc(PRESTATOR.address)}, telefon: ${esc(PRESTATOR.phone)}, email: ${esc(PRESTATOR.email)}, în calitate de <span class="bold">PRESTATOR</span></p>

<p style="margin-top: 8px;"><span class="bold">BENEFICIAR:</span> Dl/Dna <span class="underline">${esc(contract.clientName as string || "________________________")}</span>, cu C.I. seria și numărul <span class="underline">${esc(contract.clientIdSeries as string || "________________")}</span>, domiciliul <span class="underline">${esc(contract.clientAddress as string || "________________________")}</span>, telefon <span class="underline">${esc(contract.clientPhone as string || "________________")}</span>, în calitate de <span class="bold">BENEFICIAR</span></p>

<p class="section" style="margin-top: 14px;">2. Obiectul contractului:</p>
<p>Obiectul acestui contract îl constituie evenimentul din data de <span class="bold">${eventDateFormatted}</span>, în intervalul orar aproximativ: <span class="bold">${esc(contract.eventStartTime as string || "____")} – ${esc(contract.eventEndTime as string || "____")}</span> <span style="font-size:9pt; color:#555;">(orar orientativ, cu titlu de aproximație)</span>.</p>
${contract.eventLocation ? `<p>Locația evenimentului: <span class="bold">${esc(contract.eventLocation as string)}</span></p>` : ""}
${contract.eventType ? `<p>Tipul evenimentului: <span class="bold">${esc(contract.eventType as string)}</span></p>` : ""}


<p class="section">3. Conținutul serviciului și prețul:</p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
${services.map(s => {
  const cur = esc(contract.currency as string || "RON");
  if (s.isTransport && contract.transportKm) {
    const km = Number(contract.transportKm);
    const fuelPrice = Number(contract.transportFuelPrice) || 10;
    const estimated = Math.ceil(km * 6 / 100 * fuelPrice);
    return `
  <tr>
    <td style="padding: 3px 0;">
      ${esc(s.label)}<br/>
      <span style="font-size:8.5pt;color:#777;">${km} km × 6L/100km × ${fuelPrice} lei/L (preț carburant estimat la data semnării)</span>
    </td>
    <td style="padding: 3px 0; text-align: right; vertical-align: top;">
      ~${estimated} ${cur}<br/>
      <span style="font-size:8pt;color:#999;font-style:italic;">estimat*</span>
    </td>
  </tr>`;
  }
  return `
  <tr>
    <td style="padding: 3px 0;">${esc(s.label)}</td>
    <td style="padding: 3px 0; text-align: right;">${s.price > 0 ? esc(s.price.toString()) + " " + cur : s.gratuit ? "INCLUS GRATUIT" : "inclus"}</td>
  </tr>`;
}).join("")}
  <tr class="total-row">
    <td style="padding: 6px 0; border-top: 1px solid #999;">TOTAL</td>
    <td style="padding: 6px 0; border-top: 1px solid #999; text-align: right;">${priceTotal} ${esc(contract.currency as string || "RON")}</td>
  </tr>
</table>
${services.some(s => s.isTransport && contract.transportKm) ? `<p style="font-size:8.5pt;color:#777;margin-bottom:6px;">* Taxa de transport este estimativă, calculată la ${esc(String(contract.transportFuelPrice || "10"))} lei/litru și un consum de 6L/100km. Suma finală va fi comunicată cu 7 zile înainte de eveniment, în funcție de prețul real al carburantului din acea perioadă.</p>` : ""}

<p class="section">4. Produsul livrat — specificații foto/video:</p>
<p>PRESTATORUL se angajează să surprindă toate momentele cheie ale evenimentului, fără un număr fix prestabilit de cadre. Numărul minim garantat de fotografii finale editate este de <span class="bold">600 fotografii</span>, la rezoluție înaltă (full resolution). De regulă, la evenimente complete, livrăm între <span class="bold">900 și 1.200 de fotografii</span> editate.</p>
<p><span class="bold">Stilul fotografic:</span> documentar — surprindem momentele natural, fără punere în scenă forțată.</p>
<p>Materialele video vor fi realizate la rezoluție <span class="bold">4K</span>. <span class="bold">Filmul lung</span> (after movie complet) va avea o durată cuprinsă între <span class="bold">4 și 6 ore</span>, realizat în stil documentar/vlog — filmat natural, fără intervenții artistice. <span class="bold">Videoul scurt</span> (teaser), acolo unde este inclus, va fi realizat în stil cinematic/artistic, cu montaj profesional și coloană sonoră adecvată.</p>

<p class="section">5. Drepturi asupra imaginilor foto/video:</p>
${contract.privateClient
  ? `<p><span class="bold">Confidențialitate totală:</span> La solicitarea expresă a BENEFICIARULUI, toate materialele foto și video realizate în cadrul acestui Contract sunt strict confidențiale și destinate exclusiv uzului personal al acestuia. PRESTATORUL nu va publica, distribui sau utiliza în niciun scop public (portofoliu, social media, marketing, târguri, concursuri sau orice alt canal) niciuna dintre imaginile sau materialele video rezultate. Această clauză este obligatorie și are caracter permanent.</p>`
  : `<p>PRESTATORUL își rezervă dreptul de a utiliza imaginile foto și/sau video realizate în cadrul acestui Contract pentru promovarea activității sale, inclusiv pe rețelele de socializare, portofoliu online, marketing, târguri sau concursuri. Imaginile vor fi alese de PRESTATOR dintre cele mai reprezentative din perspectivă artistică. În cazul în care BENEFICIARUL dorește confidențialitate totală asupra materialelor, acesta trebuie să notifice PRESTATORUL în scris, anterior semnării contractului.</p>`
}

<p class="section">6. Prețul prezentului contract este de ${priceTotal} ${esc(contract.currency as string || "RON")}, și se achită astfel:</p>
<p>Un avans de: <span class="bold">${priceAdvance} ${esc(contract.currency as string || "RON")}</span>${contract.advancePaidAt ? ", scadent la data de " + esc(contract.advancePaidAt as string) : ""}, urmat de suma de <span class="bold">${priceRest} ${esc(contract.currency as string || "RON")}</span>${contract.restPaidAt ? ", scadent la data de " + esc(contract.restPaidAt as string) : ""}.</p>
<p>Contractul intră în legalitate în momentul primirii avansului.</p>
<p>Metodă de plată: ${esc(contract.paymentMethod as string || "transfer bancar")}.</p>
${contract.paymentMethod === "Cash"
  ? `<p>Plata se realizează în numerar (cash), direct către PRESTATOR.</p>`
  : `<p>Plata se realizează în contul:<br/><span class="bold">${esc(PRESTATOR.name)}</span><br/><span class="bold" style="letter-spacing:1px;">${esc(PRESTATOR.iban)}</span> (${esc(PRESTATOR.bank)})</p>`
}

<p class="section">7. Termene standard de predare:</p>
<p>7.1. Fotografii preview: până la 20 fotografii editate în termen de 7 (șapte) zile calendaristice.</p>
<p>7.2. Restul materialelor foto finale: în termen de 30 (treizeci) de zile calendaristice.</p>
<p>7.3. Materiale video finale (teaser/film/after movie): în termen de 60 (șaizeci) de zile calendaristice.</p>
<p>Toate materialele se livrează exclusiv după achitarea integrală a sumelor datorate conform prezentului contract.</p>

<p class="section">8. Forța majoră:</p>
<p>Forța majoră apără de răspundere partea care o invocă în scris, în termen de 5 zile de la data producerii acesteia. Prin caz de forță majoră se înțeleg împrejurările neprevăzute și inevitabile pentru una dintre părți, incluzând dar nelimitându-se la: accident, rănire, boală, incendiu, furt, urgență familială (rudele de gradul întâi și doi) sau orice alt act sau situație dincolo de controlul părților, recunoscut de lege ca fiind un caz de forță majoră.</p>

<p class="section">9. Condiții atmosferice:</p>
<p>PRESTATORUL poate refuza fotografierea și/sau filmarea anumitor evenimente atunci când condițiile atmosferice (temperatură, umiditate, precipitații) pun în pericol aparatura utilizată.</p>

<p class="section">10. Răspunderea prestatorului și limitări:</p>
<p>În cazul în care PRESTATORUL nu realizează din vina sa imaginile care fac obiectul acestui Contract, el este responsabil în fața BENEFICIARULUI numai pentru sumele plătite de către acesta, neintrând în discuție orice cheltuieli făcute între timp de către PRESTATOR.</p>
<p>PRESTATORUL nu poate fi tras la răspundere pentru: calitatea fotografiilor afectată de condiții de iluminat insuficient sau necontrolabil (biserici fără lumină, săli întunecate), spații aglomerate care limitează accesul fotografului/videografului, momente neacoperite ca urmare a restricțiilor impuse de oficianți (preoți, primari, MC) sau a nepunctualității participanților.</p>
<p>Cooperarea invitaților la fotografiile de grup și la momentele cheie este responsabilitatea exclusivă a BENEFICIARULUI. PRESTATORUL nu răspunde pentru momentele ratate din cauza lipsei de cooperare a invitaților sau a organizării defectuoase a evenimentului.</p>

<p class="section">11. Obligația de contactare prealabilă:</p>
<p>BENEFICIARUL are obligația de a contacta PRESTATORUL cu cel puțin 7 (șapte) zile calendaristice înainte de data evenimentului, printr-un mijloc de comunicare confirmat (telefon, mesaj scris, e-mail sau alt canal agreat). Această obligație are scopul de a reconfirma detaliile evenimentului și de a asigura păstrarea corectă a informațiilor contractuale.</p>
<p>În cazul în care BENEFICIARUL nu respectă această obligație, PRESTATORUL nu poate fi tras la răspundere pentru eventuale neconcordanțe, pierderi de informații sau imposibilitatea de a presta serviciile în condițiile stabilite.</p>

<p class="section">12. Itinerariul evenimentului:</p>
<p>BENEFICIARUL are obligația de a transmite PRESTATORULUI, cu cel puțin 4–5 zile calendaristice înainte de eveniment (prin WhatsApp sau în scris), programul complet al zilei (itinerariul), incluzând orele aproximative pentru fiecare moment: domiciliul miresei, domiciliul mirelui, locația ceremoniei civile și/sau religioase, locația recepției, precum și orice alte momente relevante.</p>
<p>BENEFICIARUL va ține cont de timpii de deplasare între locații atunci când stabilește programul, pentru a permite PRESTATORULUI să fie prezent la fiecare moment important. Netransmiterea itinerariului cu cel puțin 4–5 zile înainte îl exonerează pe PRESTATOR de răspunderea pentru momentele fotografice/video neacoperite.</p>
<div style="margin: 8px 0; padding: 10px 14px; background: #f7f7f7; border-left: 3px solid #bbb; font-size: 9.5pt; color: #555; line-height: 1.6;">
  <strong>Notă informativă — Cum se calculează itinerariul:</strong><br/>
  Luați în considerare: ora la care coafura/machiajul este programat → timpul de pregătire completă → deplasarea la domiciliul mirelui → deplasarea la cununie civilă → deplasarea la cununie religioasă → deplasarea la locația recepției. Adăugați minim 20–30 de minute tampon între fiecare locație pentru deplasare și neprevăzut. Fotograful/videograful trebuie să ajungă înaintea voastră la fiecare locație.
</div>

<p class="section">13. Politica de anulare:</p>
<p><span class="bold">Abandon din partea Prestatorului:</span> Dacă PRESTATORUL renunță unilateral cu mai mult de 30 de zile înainte de eveniment, returnează integral avansul/arvuna încasat(ă). În caz de forță majoră documentat (accident/spitalizare/deces), avansul este returnat integral.</p>
<p><span class="bold">Abandon din partea Beneficiarului:</span> Avansul/arvuna este nereturnabil(ă) indiferent de momentul abandonului. Materialele se predau numai după achitarea integrală a sumelor datorate.</p>

<p class="section">14. Protecția datelor personale (GDPR):</p>
<p>PRESTATORUL prelucrează datele cu caracter personal ale BENEFICIARULUI (nume, adresă, serie și număr CI, semnătură electronică, adresă de e-mail, telefon) exclusiv în scopul încheierii și executării prezentului contract, în conformitate cu Regulamentul (UE) 2016/679 (GDPR). Datele sunt stocate electronic în condiții de securitate și nu vor fi transmise unor terți, cu excepția obligațiilor legale. BENEFICIARUL confirmă că a luat la cunoștință și este de acord cu prelucrarea datelor sale în scopurile menționate, și că dispune de dreptul de acces, rectificare și ștergere a datelor, prin solicitare scrisă adresată PRESTATORULUI.</p>

${contract.eventDetails ? `<p class="section">15. Mențiuni suplimentare:</p><p>${esc(contract.eventDetails as string)}</p>` : ""}

<!-- SEMNĂTURI -->
<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">Prestator</div>
    ${contract.prestatorSignatureBase64
      ? `<img src="${contract.prestatorSignatureBase64}" style="max-width: 220px; max-height: 50px; display: block; margin-bottom: 6px;" alt="Semnatura prestator" />`
      : `<div style="height: 50px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>`}
    <div class="sig-name">${esc(PRESTATOR.representative)}</div>
    <div class="sig-date">${signedDate}</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Beneficiar</div>
    ${contract.clientSignatureBase64
      ? `<img src="${contract.clientSignatureBase64}" style="max-width: 220px; max-height: 50px; display: block; margin-bottom: 6px;" alt="Semnatura" />`
      : `<div style="height: 50px; border-bottom: 1px solid #333; margin-bottom: 6px;"></div>`}
    <div class="sig-name">${esc(contract.clientName as string || "")}</div>
    <div class="sig-date">${signedDate}</div>
  </div>
</div>

<div class="footer">
  Document semnat electronic &nbsp;•&nbsp; ${new Date(toIsoString(contract.signedAt) ?? Date.now()).toLocaleString("ro-RO")} &nbsp;•&nbsp; IP: ${esc(contract.clientIp as string || "necunoscut")}
</div>

</body>
</html>`;

  // Bold PRESTATOR / BENEFICIAR în toate nodurile text, fără a atinge atributele HTML
  return html.replace(/>([^<]+)</g, (_, text: string) =>
    ">" + text.replace(/\b(PRESTATOR(?:UL|ULUI)?|BENEFICIAR(?:UL|ULUI)?)\b/g, "<strong>$1</strong>") + "<"
  );
}
