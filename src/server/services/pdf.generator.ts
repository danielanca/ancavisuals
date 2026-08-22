import puppeteer from "puppeteer";

// Provider details — fixed
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

interface StoredClauseSnapshot {
  templateId?: string;
  key?: string;
  title: string;
  body: string;
  order?: number;
  groupKey?: string | null;
}

// Rows sharing the same groupKey (e.g. "Termene standard de predare" split into per-service lines)
// get concatenated under a single numbered section, ordered by the lowest `order` in the group.
function renderStoredClauseArticles(clauses: StoredClauseSnapshot[]): { title: string; body: string }[] {
  const groups = new Map<string, { title: string; order: number; bodies: string[] }>();
  const groupIds: string[] = [];
  for (const c of clauses) {
    const groupId = c.groupKey || c.key || c.title;
    if (!groups.has(groupId)) {
      groups.set(groupId, { title: c.title, order: c.order ?? 0, bodies: [] });
      groupIds.push(groupId);
    }
    const g = groups.get(groupId)!;
    g.bodies.push(c.body);
    g.order = Math.min(g.order, c.order ?? g.order);
  }
  return groupIds
    .map((id) => groups.get(id)!)
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ title: g.title, body: g.bodies.join("\n") }));
}

export function resolveBankDetails(contract: Record<string, unknown>) {
  return {
    beneficiaryName: String(contract.bankBeneficiaryName ?? "").trim(),
    iban: String(contract.bankIban ?? "").trim(),
  };
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });
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

export async function generateContractPDF(contract: Record<string, unknown>): Promise<Buffer> {
  return renderHtmlToPdf(buildContractHTML(contract));
}

export async function generateHandoverPDF(handover: Record<string, unknown>): Promise<Buffer> {
  return renderHtmlToPdf(buildHandoverHTML(handover));
}

export function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converts a Firestore Timestamp or ISO string to an ISO string, or undefined */
function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  // Firestore Timestamp: { _seconds, _nanoseconds } or { seconds, nanoseconds }
  if (typeof value === "object") {
    const ts = value as Record<string, unknown>;
    const secs = (ts._seconds ?? ts.seconds);
    if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  }
  return String(value);
}

export function formatDate(value: unknown): string {
  const iso = toIsoString(value);
  if (!iso) return "___________";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "___________";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatShortDate(value: unknown): string {
  const iso = toIsoString(value);
  if (!iso) return "___________";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "___________";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** True when the end time is not strictly after the start time, meaning the event
 * necessarily runs past midnight into the day after the event date. */
function eventCrossesMidnight(startTime: unknown, endTime: unknown): boolean {
  const start = String(startTime ?? "").trim();
  const end = String(endTime ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false;
  return end <= start;
}

export interface ServiceFlags {
  hasFoto: boolean;
  hasVideo: boolean;
  hasPhotobooth: boolean;
  hasVideobooth: boolean;
  hasPhotoVideo: boolean;
}

export function detectServiceFlags(services: ContractService[], contractType?: string): ServiceFlags {
  const labels = services.map((s) => s.label.toLowerCase());
  const type = (contractType ?? "").toLowerCase();

  const hasFoto = labels.some((l) => l.includes("foto") && !l.includes("fotocabin") && !l.includes("photo booth") && !l.includes("cabina")) || type.includes("foto");
  const hasVideo = labels.some((l) => (l.includes("video") && !l.includes("videobooth") && !l.includes("video cabin") && !l.includes("video cab")) || l.includes("teaser")) || type.includes("video");
  const hasPhotobooth = labels.some((l) => l.includes("fotocabin") || l.includes("photo booth") || l.includes("photobooth") || l.includes("videobooth") || l.includes("video cab")) || type.includes("photobooth");
  const hasVideobooth = labels.some((l) => l.includes("videobooth") || l.includes("video cab") || l.includes("video 360") || l.includes("360°")) || type.includes("videobooth");

  return { hasFoto, hasVideo, hasPhotobooth, hasVideobooth, hasPhotoVideo: hasFoto || hasVideo };
}

export function computeContractTitle(flags: Pick<ServiceFlags, "hasFoto" | "hasVideo" | "hasPhotobooth" | "hasPhotoVideo">): string {
  const { hasFoto, hasVideo, hasPhotobooth, hasPhotoVideo } = flags;
  return hasPhotoVideo && hasPhotobooth
    ? "Foto-Video & Fotocabină"
    : hasPhotobooth && !hasPhotoVideo
      ? "Fotocabină / Photo Booth"
      : hasVideo && !hasFoto ? "Video"
      : hasFoto && !hasVideo ? "Foto"
      : "Foto-Video";
}

export function computeTransportEstimate(km: number, fuelPrice: number): number {
  return Math.ceil(km * 6 / 100 * fuelPrice);
}

export function buildContractHTML(contract: Record<string, unknown>): string {
  const signedDate = formatDate(contract.signedAt);
  const eventDateFormatted = formatDate(contract.eventDate);
  const contractDate = formatShortDate(contract.signedAt ?? contract.createdAt);

  const services = (contract.services as ContractService[]) ?? [];
  const priceTotal = Number(contract.priceTotal) || 0;
  const priceAdvance = Number(contract.priceAdvance) || 0;
  const priceRest = Number(contract.priceRest) || (priceTotal - priceAdvance);
  const cur = esc(contract.currency as string || "RON");
  const bankDetails = resolveBankDetails(contract);

  const { hasFoto, hasVideo, hasPhotobooth, hasVideobooth, hasPhotoVideo } = detectServiceFlags(services, contract.contractType as string);

  const contractTitle = computeContractTitle({ hasFoto, hasVideo, hasPhotobooth, hasPhotoVideo });

  // Build the article list conditionally; null = omitted
  const articles: Array<{ title: string; body: string } | null> = [

    // ── 1. Contracting parties ───────────────────────────────────────────────
    {
      title: "Părțile contractante",
      body: `
        <p><span class="bold">PRESTATOR:</span> ${esc(PRESTATOR.name)}, CUI: ${esc(PRESTATOR.cui)}, cu domiciliul în ${esc(PRESTATOR.address)}, telefon: ${esc(PRESTATOR.phone)}, email: ${esc(PRESTATOR.email)}, în calitate de <span class="bold">PRESTATOR</span></p>
        ${contract.clientType === "PJ"
          ? `<p style="margin-top:8px;"><span class="bold">BENEFICIAR:</span> ${esc(contract.clientEntityType as string || "Persoană juridică")} <span class="underline">${esc(contract.clientName as string || "________________________")}</span>, CIF/CUI <span class="underline">${esc(contract.clientCIF as string || "________________")}</span>${contract.clientRegistrationNumber ? `, nr. înregistrare ${esc(contract.clientRegistrationNumber as string)}` : ""}, cu sediul în <span class="underline">${esc(contract.clientAddress as string || "________________________")}</span>${contract.clientCity || contract.clientCounty ? `, ${esc([contract.clientCity, contract.clientCounty].filter(Boolean).join(", "))}` : ""}, telefon ${esc(contract.clientPhone as string || "________________")}${contract.clientBankName || contract.clientIBAN ? `, cont ${esc(contract.clientIBAN as string || "________________")} deschis la ${esc(contract.clientBankName as string || "________________")}` : ""}, în calitate de <span class="bold">BENEFICIAR</span></p>
             <p style="margin-top:8px;"><span class="bold">Reprezentant/delegat:</span> ${esc(contract.clientRepresentativeName as string || "________________________")}, CI seria și numărul <span class="underline">${esc(contract.clientRepresentativeIdSeries as string || "________________")}</span>, în calitate de ${esc(contract.clientRepresentativeRole as string || "delegat")}, care semnează în numele și pentru BENEFICIAR</p>`
          : `<p style="margin-top:8px;"><span class="bold">BENEFICIAR:</span> Dl/Dna <span class="underline">${esc(contract.clientName as string || "________________________")}</span>, cu C.I. seria și numărul <span class="underline">${esc(contract.clientIdSeries as string || "________________")}</span>, domiciliul <span class="underline">${esc(contract.clientAddress as string || "________________________")}</span>, telefon <span class="underline">${esc(contract.clientPhone as string || "________________")}</span>, în calitate de <span class="bold">BENEFICIAR</span></p>`}
      `,
    },

    // ── 2. Contract subject ──────────────────────────────────────────────────
    {
      title: "Obiectul contractului",
      body: `
        <p>Obiectul acestui contract îl constituie evenimentul din data de <span class="bold">${eventDateFormatted}</span>, în intervalul orar aproximativ: <span class="bold">${esc(contract.eventStartTime as string || "____")} – ${esc(contract.eventEndTime as string || "____")}</span> <span style="font-size:9pt;color:#555;">(orar orientativ, cu titlu de aproximație)</span>.</p>
        ${eventCrossesMidnight(contract.eventStartTime, contract.eventEndTime) ? `<p style="font-size:9pt;color:#555;"><span class="bold">Notă:</span> evenimentul se prelungește după miezul nopții (ora 00:00), ora de final indicată mai sus aparținând zilei următoare datei evenimentului de mai sus.</p>` : ""}
        <p style="font-size:9pt;color:#555;">PRESTATORUL trebuie să cunoască cu exactitate, cât mai devreme posibil, intervalul orar al evenimentului, întrucât echipa PRESTATORULUI poate avea alte evenimente programate în dimineața următoare. Dacă evenimentul BENEFICIARULUI se prelungește până la ora 02:00–03:00 noaptea, iar echipa are un alt eveniment programat dimineața, la ora 08:00, nu pot fi asigurate condiții decente de odihnă (minimum 8 ore de somn) pentru echipa PRESTATORULUI.</p>
        ${contract.eventLocation ? `<p>Locația evenimentului: <span class="bold">${esc(contract.eventLocation as string)}</span></p>` : ""}
        ${contract.eventType ? `<p>Tipul evenimentului: <span class="bold">${esc(contract.eventType as string)}</span></p>` : ""}
      `,
    },

    // ── 3. Services and price ────────────────────────────────────────────────
    {
      title: "Conținutul serviciului și prețul",
      body: `
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
          ${services.map((s, idx) => {
            const bg = idx % 2 === 0 ? "background:#f7f7f7;" : "";
            const cell = `padding:5px 8px;`;
            if (s.isTransport && contract.transportKm) {
              const km = Number(contract.transportKm);
              const fuelPrice = Number(contract.transportFuelPrice) || 10;
              const estimated = computeTransportEstimate(km, fuelPrice);
              return `<tr style="${bg}">
                <td style="${cell}">${esc(s.label)}<br/><span style="font-size:8.5pt;color:#777;">${km} km × 6L/100km × ${fuelPrice} lei/L (preț carburant estimat la data semnării)</span></td>
                <td style="${cell}text-align:right;vertical-align:top;">~${estimated} ${cur}<br/><span style="font-size:8pt;color:#999;font-style:italic;">estimat*</span></td>
              </tr>`;
            }
            return `<tr style="${bg}">
              <td style="${cell}">${esc(s.label)}</td>
              <td style="${cell}text-align:right;">${s.price > 0 ? esc(s.price.toString()) + " " + cur : s.gratuit ? "INCLUS GRATUIT" : "inclus"}</td>
            </tr>`;
          }).join("")}
          <tr><td style="padding:6px 8px;border-top:2px solid #999;font-weight:700;">TOTAL</td><td style="padding:6px 8px;border-top:2px solid #999;text-align:right;font-weight:700;font-size:11pt;">${priceTotal} ${cur}</td></tr>
        </table>
        ${services.some(s => s.isTransport && contract.transportKm) ? `<p style="font-size:8.5pt;color:#777;">* Taxa de transport este estimativă, calculată la ${esc(String(contract.transportFuelPrice || "10"))} lei/litru și un consum de 6L/100km. Suma finală va fi comunicată cu 7 zile înainte de eveniment, în funcție de prețul real al carburantului din acea perioadă.</p>` : ""}
      `,
    },

    // ── 3b. Exhaustive list of included materials/services ───────────────────
    {
      title: "Materiale și servicii incluse — clauză de exhaustivitate",
      body: `
        <p>PRESTATORUL este obligat să ofere BENEFICIARULUI exclusiv materialele, accesoriile, albumele și celelalte servicii care sunt menționate expres în prezentul contract (inclusiv în tabelul de mai sus).</p>
        <p>Orice discuții, promisiuni sau înțelegeri purtate verbal, telefonic sau prin mesaje, care nu sunt consemnate în scris în prezentul contract, nu constituie o obligație contractuală și nu pot fi invocate de BENEFICIAR ca temei pentru solicitarea lor.</p>
        <p>Dacă BENEFICIARUL a convenit cu PRESTATORUL asupra unui material, accesoriu sau serviciu suplimentar care nu apare în prezentul contract, este obligația BENEFICIARULUI de a solicita PRESTATORULUI modificarea în scris a contractului, înainte de eveniment. În lipsa acestei modificări scrise, comunicarea verbală nu reprezintă o garanție a primirii respectivului material, accesoriu sau serviciu.</p>
        <p>Prin semnarea prezentului contract, BENEFICIARUL confirmă că a citit și a înțeles pe deplin prezenta clauză și este de acord că nu poate ridica nicio pretenție față de PRESTATOR pentru materiale, accesorii sau servicii care nu sunt menționate expres în prezentul contract, indiferent de eventualele discuții purtate verbal, telefonic sau prin mesaje.</p>
      `,
    },

    // ── 4. Photo specifications (if photo service exists) ────────────────────
    hasFoto ? {
      title: "Produsul livrat — specificații fotografice",
      body: `
        <p>PRESTATORUL se angajează să surprindă toate momentele cheie ale evenimentului, fără un număr fix prestabilit de cadre. Numărul minim garantat de fotografii finale editate este de <span class="bold">600 fotografii</span>, la rezoluție înaltă (full resolution). De regulă, la evenimente complete, livrăm între <span class="bold">900 și 1.200 de fotografii</span> editate.</p>
        <p><span class="bold">Stilul fotografic:</span> documentar — surprindem momentele natural, fără punere în scenă forțată.</p>
        <p>Fotografiile finale se livrează în format digital, pe platformă online securizată, accesibilă exclusiv BENEFICIARULUI.</p>
      `,
    } : null,

    // ── 5. Video specifications (if video service exists) ────────────────────
    hasVideo ? {
      title: "Produsul livrat — specificații video",
      body: `
        <p>Materialele video vor fi realizate la rezoluție <span class="bold">4K</span>. <span class="bold">Filmul lung</span> (after movie complet) va avea o durată cuprinsă între <span class="bold">4 și 6 ore</span>, realizat în stil documentar/vlog — filmat natural, fără intervenții artistice.</p>
        <p><span class="bold">Videoul scurt</span> (teaser), acolo unde este inclus în pachet, va fi realizat în stil cinematic/artistic, cu montaj profesional și coloană sonoră adecvată.</p>
        <p>Materialele video finale se livrează în format digital, pe platformă online securizată, accesibilă exclusiv BENEFICIARULUI.</p>
      `,
    } : null,

    // ── 6. Photobooth specifications (if photobooth service exists) ──────────
    hasPhotobooth ? {
      title: "Produsul livrat — specificații fotocabină / photo booth",
      body: `
        <p>PRESTATORUL asigură montarea, configurarea și operarea echipamentului de tip <span class="bold">Fotocabină / Photo Booth</span> pe durata evenimentului stabilit prin prezentul contract.</p>
        <p>Serviciul include:</p>
        <ul style="margin:6px 0 6px 20px;line-height:1.7;">
          <li>Echipament foto profesional cu declanșare automată sau la comandă</li>
          <li><span class="bold">Fotografii nelimitate</span> pe toată durata utilizării fotocabinei</li>
          <li><span class="bold">Livrare instantă</span> a fotografiilor (imprimare la fața locului și/sau livrare digitală imediată pe dispozitivul personal)</li>
          <li><span class="bold">Magnet personalizat</span> inclus pentru fiecare sesiune foto</li>
          <li>Asistență tehnică din partea PRESTATORULUI pe toată durata evenimentului</li>
        </ul>
        <p>Fotografiile realizate prin intermediul fotocabinei sunt proprietatea BENEFICIARULUI și pot fi distribuite liber de către acesta și invitații săi.</p>
        <p>PRESTATORUL nu poate fi tras la răspundere pentru defecțiuni tehnice generate de factori externi (întreruperi de curent, defecțiuni ale instalației electrice din locație), situație în care va depune toate diligențele pentru remedierea rapidă.</p>
        ${hasVideobooth ? `
        <div style="margin:10px 0;padding:10px 14px;background:#fff8f0;border-left:3px solid #d97706;font-size:9.5pt;color:#444;line-height:1.6;">
          <strong>Clauză VideoBooth 360° — Limitarea răspunderii privind siguranța participanților:</strong><br/><br/>
          PRESTATORUL va delimita zona de operare a echipamentului rotativ cu <span class="bold">stâlpi și bandă de delimitare</span>, pentru a restricționa accesul neautorizat în aria de rotație a brațului aparatului.<br/><br/>
          BENEFICIARUL înțelege și acceptă că echipamentul VideoBooth 360° este un dispozitiv cu element rotativ care poate cauza accidente în cazul în care persoane — în special copii — pătrund în zona de protecție delimitată în timpul funcționării acestuia.<br/><br/>
          <span class="bold">PRESTATORUL nu își asumă nicio răspundere pentru accidentele, rănirile sau prejudiciile cauzate persoanelor care depășesc zona de delimitare în timpul funcționării echipamentului.</span> Supravegherea copiilor și a participanților în apropierea echipamentului rotativ este responsabilitatea exclusivă a BENEFICIARULUI și/sau a părinților/însoțitorilor acestora.<br/><br/>
          Prin semnarea prezentului contract, BENEFICIARUL confirmă că a luat la cunoștință această clauză și că va informa invitații cu privire la normele de siguranță în zona VideoBooth 360°.
        </div>` : ""}
      `,
    } : null,

    // ── 7. Image rights (photo/video only) ──────────────────────────────────
    hasPhotoVideo ? {
      title: "Drepturi asupra imaginilor foto/video",
      body: contract.privateClient
        ? `<p><span class="bold">Confidențialitate totală:</span> La solicitarea expresă a BENEFICIARULUI, toate materialele foto și video realizate în cadrul acestui Contract sunt strict confidențiale și destinate exclusiv uzului personal al acestuia. PRESTATORUL nu va publica, distribui sau utiliza în niciun scop public (portofoliu, social media, marketing, târguri, concursuri sau orice alt canal) niciuna dintre imaginile sau materialele video rezultate. Această clauză este obligatorie și are caracter permanent.</p>`
        : `<p>PRESTATORUL își rezervă dreptul de a utiliza imaginile foto și/sau video realizate în cadrul acestui Contract pentru promovarea activității sale, inclusiv pe rețelele de socializare, portofoliu online, marketing, târguri sau concursuri. Imaginile vor fi alese de PRESTATOR dintre cele mai reprezentative din perspectivă artistică. În cazul în care BENEFICIARUL dorește confidențialitate totală asupra materialelor, acesta trebuie să notifice PRESTATORUL în scris, anterior semnării contractului.</p>`,
    } : null,

    // ── 7b. Acceptance of artistic style ──────────────────────────────────────
    hasPhotoVideo ? {
      title: "Acceptarea stilului artistic",
      body: `
        <p>BENEFICIARUL declară că a vizualizat în prealabil portofoliul PRESTATORULUI și este pe deplin de acord cu stilul artistic în care acesta realizează fotografiile și/sau materialele video, astfel cum sunt descrise în prezentul contract (stil documentar, cinematic/artistic, editare, culori, montaj etc.).</p>
        <p>BENEFICIARUL declară că nu va avea pretenții de restituire materială sau financiară motivate de nemulțumiri legate de stilul artistic/creativ al fotografiilor și/sau materialelor video livrate, acest stil fiind cunoscut și acceptat anterior semnării prezentului contract.</p>
      `,
    } : null,

    // ── 8. Price and payment ─────────────────────────────────────────────────
    {
      title: `Prețul contractului și modalitatea de plată`,
      body: (() => {
        const noAdvance = contract.noAdvance === true;
        const paymentClause = noAdvance
          ? `<p>Suma integrală de <span class="bold">${priceTotal} ${cur}</span>${contract.restPaidAt ? ", scadentă la data de " + esc(contract.restPaidAt as string) : ""}.</p>`
          : `<p>Un avans de: <span class="bold">${priceAdvance} ${cur}</span>${contract.advancePaidAt ? ", scadent la data de " + esc(contract.advancePaidAt as string) : ""}, urmat de suma de <span class="bold">${priceRest} ${cur}</span>${contract.restPaidAt ? ", scadent la data de " + esc(contract.restPaidAt as string) : ""}.</p>
        <p>Contractul intră în legalitate în momentul primirii avansului.</p>`;
        return `
        <p>Prețul prezentului contract este de <span class="bold">${priceTotal} ${cur}</span> și se achită astfel:</p>
        ${paymentClause}
        <p>Metodă de plată: ${esc(contract.paymentMethod as string || "transfer bancar")}.</p>
        ${contract.paymentMethod === "Cash"
          ? `<p>Plata se realizează în numerar (cash), direct către PRESTATOR.</p>`
          : `<p>Plata se realizează în contul beneficiarului: <span class="bold">${esc(bankDetails.beneficiaryName || "________________________")}</span> — <span class="bold" style="letter-spacing:1px;">${esc(bankDetails.iban || "________________________")}</span></p>`}
        `;
      })(),
    },

    // ── 9. Delivery deadlines ────────────────────────────────────────────────
    {
      title: "Termene standard de predare",
      body: (() => {
        const lines: string[] = [];
        let idx = 1;
        if (hasFoto) {
          lines.push(`<p>${idx++}. Fotografii preview: până la 20 fotografii editate în termen de 7 (șapte) zile calendaristice.</p>`);
          lines.push(`<p>${idx++}. Restul materialelor foto finale: în termen de 30 (treizeci) de zile calendaristice.</p>`);
        }
        if (hasVideo) {
          lines.push(`<p>${idx++}. Materiale video finale (teaser/film/after movie): în termen de 60 (șaizeci) de zile calendaristice.</p>`);
        }
        if (hasPhotobooth) {
          lines.push(`<p>${idx++}. Materialele digitale din fotocabină se livrează în termen de 24 de ore de la eveniment, pe suport digital agreat cu BENEFICIARUL.</p>`);
        }
        lines.push(`<p>Toate materialele se livrează exclusiv după achitarea integrală a sumelor datorate conform prezentului contract.</p>`);
        return lines.join("\n");
      })(),
    },

    // ── 10. Client backup responsibility ────────────────────────────────────
    {
      title: "Responsabilitatea beneficiarului privind stocarea materialelor",
      body: `
        <p>BENEFICIARUL este responsabil de efectuarea unui <span class="bold">back-up</span> (copie de rezervă a fișierelor, stocată pe un dispozitiv propriu sau pe un serviciu de stocare în cloud) al tuturor materialelor — fotografii și/sau materiale video — primite de la PRESTATOR.</p>
        <p>PRESTATORUL nu poate fi tras la răspundere pentru pierderea, deteriorarea sau indisponibilitatea materialelor după livrarea acestora, indiferent de cauza producerii acestora, inclusiv ca urmare a trecerii timpului, defecțiunilor tehnice sau expirării platformei de livrare.</p>
      `,
    },

    // ── 11. Force majeure ────────────────────────────────────────────────────
    {
      title: "Forța majoră",
      body: `<p>Forța majoră apără de răspundere partea care o invocă în scris, în termen de 5 zile de la data producerii acesteia. Prin caz de forță majoră se înțeleg împrejurările neprevăzute și inevitabile pentru una dintre părți, incluzând dar nelimitându-se la: accident, rănire, boală, incendiu, furt, urgență familială (rudele de gradul întâi și doi) sau orice alt act sau situație dincolo de controlul părților, recunoscut de lege ca fiind un caz de forță majoră.</p>`,
    },

    // ── 11. Weather conditions (photo/video only) ────────────────────────────
    hasPhotoVideo ? {
      title: "Condiții atmosferice",
      body: `<p>PRESTATORUL poate refuza fotografierea și/sau filmarea anumitor evenimente atunci când condițiile atmosferice (temperatură, umiditate, precipitații) pun în pericol aparatura utilizată.</p>`,
    } : null,

    // ── 12. Provider liability ───────────────────────────────────────────────
    {
      title: "Răspunderea prestatorului și limitări",
      body: `
        <p>În cazul în care PRESTATORUL nu realizează din vina sa serviciile care fac obiectul acestui Contract, el este responsabil în fața BENEFICIARULUI numai pentru sumele plătite de către acesta, neintrând în discuție orice cheltuieli făcute între timp de PRESTATOR.</p>
        ${hasPhotoVideo ? `<p>PRESTATORUL nu poate fi tras la răspundere pentru: calitatea fotografiilor/filmărilor afectată de condiții de iluminat insuficient sau necontrolabil, spații aglomerate care limitează accesul, momente neacoperite ca urmare a restricțiilor impuse de oficianți sau a nepunctualității participanților.</p>` : ""}
        ${hasPhotobooth ? `<p>PRESTATORUL nu poate fi tras la răspundere pentru defecțiuni tehnice generate de factori externi (întreruperi de curent, defecțiuni ale rețelei electrice din locație). În astfel de situații, va depune toate diligențele pentru remedierea rapidă.</p>` : ""}
      `,
    },

    // ── 12b. Refund for a non-functioning service ─────────────────────────────
    {
      title: "Returnarea sumei pentru un serviciu nefuncțional",
      body: `
        <p>În situația în care un anumit serviciu contractat (de exemplu: fotocabină / photo booth, VideoBooth 360°, QR Moments) nu poate funcționa la locul evenimentului, inclusiv din cauze care nu se datorează culpei PRESTATORULUI (de exemplu: lipsa curentului electric la locație, restricții impuse de locație sau alte cauze externe), PRESTATORUL va returna BENEFICIARULUI suma achitată aferentă serviciului respectiv, conform prețului acestuia menționat în tabelul de la secțiunea "Conținutul serviciului și prețul".</p>
        <p>Această clauză privește exclusiv suma achitată pentru serviciul care nu a funcționat și nu afectează celelalte servicii contractate, care se derulează în continuare conform prezentului contract.</p>
      `,
    },

    // ── 13. Pre-event contact obligation ────────────────────────────────────
    {
      title: "Obligația de contactare prealabilă",
      body: `
        <p>BENEFICIARUL are obligația de a contacta PRESTATORUL cu cel puțin 7 (șapte) zile calendaristice înainte de data evenimentului, printr-un mijloc de comunicare confirmat (telefon, mesaj scris, e-mail sau alt canal agreat), în scopul reconfirmării detaliilor evenimentului.</p>
        <p>Nerespectarea acestei obligații îl exonerează pe PRESTATOR de răspunderea pentru eventuale neconcordanțe sau imposibilitatea prestării serviciilor în condițiile stabilite.</p>
      `,
    },

    // ── 14. Event itinerary (photo/video only) ───────────────────────────────
    hasPhotoVideo ? {
      title: "Itinerariul evenimentului",
      body: `
        <p>BENEFICIARUL are obligația de a transmite PRESTATORULUI, cu cel puțin 4–5 zile calendaristice înainte de eveniment (prin WhatsApp sau în scris), programul complet al zilei (itinerariul), incluzând orele aproximative pentru fiecare moment: domiciliul miresei, domiciliul mirelui, locația ceremoniei civile și/sau religioase, locația recepției, precum și orice alte momente relevante.</p>
        <p>BENEFICIARUL va ține cont de timpii de deplasare între locații. Netransmiterea itinerariului cu cel puțin 4–5 zile înainte îl exonerează pe PRESTATOR de răspunderea pentru momentele fotografice/video neacoperite.</p>
        <div style="margin:8px 0;padding:10px 14px;background:#f7f7f7;border-left:3px solid #bbb;font-size:9.5pt;color:#555;line-height:1.6;">
          <strong>Notă informativă — Cum se calculează itinerariul:</strong><br/>
          Luați în considerare: ora coafurii/machiajului → pregătire completă → deplasare la mire → cununie civilă → cununie religioasă → recepție. Adăugați minim 20–30 de minute tampon între locații. Fotograful/videograful trebuie să ajungă înaintea voastră la fiecare locație.
        </div>
      `,
    } : null,

    // ── 14b. Provider's meal at the event (photo/video only) ─────────────────
    hasPhotoVideo ? {
      title: "Masa echipei prestatorului",
      body: `
        <p>BENEFICIARUL are obligația de a asigura membrilor echipei PRESTATORULUI prezenți la eveniment (fotograf/videograf) masă inclusă, similar invitaților, pe durata desfășurării evenimentului.</p>
      `,
    } : null,

    // ── 15. Cancellation policy ──────────────────────────────────────────────
    {
      title: "Politica de anulare",
      body: `
        <p><span class="bold">Abandon din partea Prestatorului:</span> Dacă PRESTATORUL renunță unilateral cu mai mult de 30 de zile înainte de eveniment, returnează integral avansul/arvuna încasat(ă). În caz de forță majoră documentat (accident/spitalizare/deces), avansul este returnat integral.</p>
        <p><span class="bold">Abandon din partea Beneficiarului:</span> Avansul/arvuna este nereturnabil(ă) indiferent de momentul abandonului. Materialele se predau numai după achitarea integrală a sumelor datorate.</p>
      `,
    },

    // ── 16. Personal data protection (GDPR) ─────────────────────────────────
    {
      title: "Protecția datelor personale (GDPR)",
      body: `<p>PRESTATORUL prelucrează datele cu caracter personal ale BENEFICIARULUI (nume, adresă, serie și număr CI, semnătură electronică, adresă de e-mail, telefon) exclusiv în scopul încheierii și executării prezentului contract, în conformitate cu Regulamentul (UE) 2016/679 (GDPR). Datele sunt stocate electronic în condiții de securitate și nu vor fi transmise unor terți, cu excepția obligațiilor legale. BENEFICIARUL confirmă că a luat la cunoștință și este de acord cu prelucrarea datelor sale în scopurile menționate și că dispune de dreptul de acces, rectificare și ștergere a datelor, prin solicitare scrisă adresată PRESTATORULUI.</p>`,
    },

    // ── 17. Additional notes (optional) ─────────────────────────────────────
    contract.eventDetails ? {
      title: "Mențiuni suplimentare",
      body: `<p>${esc(contract.eventDetails as string)}</p>`,
    } : null,
  ];

  // Contracte create prin biblioteca de clauze (Șabloane contract) au un snapshot stocat în
  // contract.clauses — dacă există, îl folosim în locul listei legacy de mai sus. Contractele
  // vechi (toate cele existente azi) au clauses gol, deci trec neschimbat pe calea legacy.
  const storedClauses = Array.isArray(contract.clauses) ? (contract.clauses as StoredClauseSnapshot[]) : [];

  let finalArticles: { title: string; body: string }[];
  if (storedClauses.length > 0) {
    // Indici ficși în array-ul de mai sus: 0=părți, 1=obiect, 2=tabel servicii, 9=preț&plată —
    // sunt singurele 4 secțiuni mereu prezente (obiecte, nu ternare) înaintea clauzei de exhaustivitate.
    const partiesArticle = articles[0] as { title: string; body: string };
    const subjectArticle = articles[1] as { title: string; body: string };
    const servicesTableArticle = articles[2] as { title: string; body: string };
    const priceAndPaymentArticle = articles[9] as { title: string; body: string };
    const additionalNotesArticle = contract.eventDetails
      ? { title: "Mențiuni suplimentare", body: `<p>${esc(contract.eventDetails as string)}</p>` }
      : null;

    finalArticles = [
      partiesArticle, subjectArticle, servicesTableArticle, priceAndPaymentArticle,
      ...renderStoredClauseArticles(storedClauses),
      ...(additionalNotesArticle ? [additionalNotesArticle] : []),
    ];
  } else {
    finalArticles = articles.filter((a): a is { title: string; body: string } => a !== null);
  }

  const renderedArticles = finalArticles
    .map((a, i) => `
      <p class="section">${i + 1}. ${a.title.toUpperCase()}:</p>
      ${a.body}
    `)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { background: #e8e8e8; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.55; background: #e8e8e8; min-height: 100vh; padding: 32px 16px 48px; }
  .page { background: #fff; max-width: 794px; margin: 0 auto; padding: 28mm 20mm; box-shadow: 0 2px 16px rgba(0,0,0,0.18); }
  @media (max-width: 600px) {
    body { padding: 12px 0 40px; background: #fff; }
    .page { padding: 20px 16px; box-shadow: none; }
    h1 { font-size: 12pt; }
    table { font-size: 9.5pt; }
  }
  @media print {
    html, body { background: transparent; padding: 0; }
    .page { box-shadow: none; max-width: none; margin: 0; padding: 0; }
  }
  h1 { font-size: 14pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .underline { text-decoration: underline; }
  .section { margin: 14px 0 6px; font-weight: 700; text-transform: uppercase; font-size: 10pt; }
  p { margin: 4px 0; }
  ul { padding-left: 20px; margin: 4px 0; }
  li { margin: 2px 0; }
  .sig-row { display: flex; gap: 60px; margin-top: 40px; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 700; }
  .sig-name { font-size: 10pt; font-weight: 700; margin-top: 4px; }
  .sig-date { font-size: 9pt; color: #666; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 8pt; color: #999; text-align: center; }
  hr { border: none; border-top: 1px solid #999; margin: 8px 0; }
</style>
</head>
<body>
<div class="page">

<h1>Contract Prestări Servicii ${contractTitle}</h1>
<p class="center">Data: ${contractDate}</p>
<hr style="margin: 10px 0;" />

${renderedArticles}

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">Prestator</div>
    ${contract.prestatorSignatureBase64
      ? `<img src="${contract.prestatorSignatureBase64}" style="max-width:220px;max-height:50px;display:block;margin-bottom:6px;" alt="Semnatura prestator" />`
      : `<div style="height:50px;border-bottom:1px solid #333;margin-bottom:6px;"></div>`}
    <div class="sig-name">${esc(PRESTATOR.representative)}</div>
    <div class="sig-date">${signedDate}</div>
  </div>
  <div class="sig-box">
    <div class="sig-label">Beneficiar</div>
    ${contract.clientSignatureBase64
      ? `<img src="${contract.clientSignatureBase64}" style="max-width:220px;max-height:50px;display:block;margin-bottom:6px;" alt="Semnatura" />`
      : `<div style="height:50px;border-bottom:1px solid #333;margin-bottom:6px;"></div>`}
    <div class="sig-name">${esc(contract.clientType === "PJ" ? (contract.clientRepresentativeName as string || contract.clientName as string || "") : (contract.clientName as string || ""))}</div>
    ${contract.clientType === "PJ" ? `<div class="sig-date">în numele ${esc(contract.clientName as string || "")}</div>` : ""}
    <div class="sig-date">${signedDate}</div>
  </div>
</div>

<div class="footer">
  Document semnat electronic &nbsp;•&nbsp; ${new Date(toIsoString(contract.signedAt) ?? Date.now()).toLocaleString("ro-RO")} &nbsp;•&nbsp; IP: ${esc(contract.clientIp as string || "necunoscut")}
</div>

</div>
</body>
</html>`;

  return html.replace(/>([^<]+)</g, (_, text: string) =>
    ">" + text.replace(/\b(PRESTATOR(?:UL|ULUI)?|BENEFICIAR(?:UL|ULUI)?)\b/g, "<strong>$1</strong>") + "<"
  );
}

export function buildHandoverHTML(handover: Record<string, unknown>): string {
  const signedDate = formatDate(handover.signedAt);
  const eventDateFormatted = formatDate(handover.eventDate);
  const documentDate = formatShortDate(handover.signedAt ?? handover.createdAt);

  const courierDeliveryDays = Number(handover.courierDeliveryDays) || 7;
  const materialsReportWindowDays = Number(handover.materialsReportWindowDays) || 7;
  const digitalLinkExpiryDays = Number(handover.digitalLinkExpiryDays) || 30;
  const awb = String(handover.awb ?? "").trim();

  // Docurile vechi nu au aceste câmpuri — presupunem link digital + curier (comportamentul dinainte), fără predare personală.
  const includeDigitalLink = handover.includeDigitalLink !== false;
  const includeCourier = handover.includeCourier !== false;
  const includePersonalHandover = Boolean(handover.includePersonalHandover);
  const digitalLinkLabels = (Array.isArray(handover.digitalLinks) ? handover.digitalLinks as { label?: unknown }[] : [])
    .map((l) => String(l?.label ?? "").trim())
    .filter(Boolean);

  const declClauses: string[] = [];
  if (includeDigitalLink) {
    declClauses.push(`Am fost informat(ă) și sunt de acord că linkul de acces digital către materialele foto/video rezultate în urma evenimentului îmi va fi trimis pe adresa de email indicată <span class="bold">imediat după semnarea prezentului document</span>, nu înainte.${digitalLinkLabels.length ? ` Materialele digitale predate includ: <span class="bold">${esc(digitalLinkLabels.join(", "))}</span>.` : ""} Înțeleg că acest link este valabil timp de <span class="bold">${digitalLinkExpiryDays} zile</span> calendaristice de la data prezentei semnături, termen în care am obligația de a descărca și salva materialele pe un dispozitiv propriu.`);
  }
  if (includeCourier) {
    declClauses.push(`Am luat la cunoștință faptul că materialele fizice (albumul și/sau alte suporturi), aferente pachetului contractat, urmează să fie livrate prin curier în termen de maximum <span class="bold">${courierDeliveryDays} zile</span> calendaristice de la data prezentei semnături.${awb ? ` Coletul are numărul de tracking (AWB) <span class="bold">${esc(awb)}</span>, pe baza căruia poate fi urmărit statusul livrării pe site-ul curierului.` : ""}`);
  }
  if (includePersonalHandover) {
    declClauses.push(`Confirm că am primit personal, direct de la PRESTATOR, materialele fizice (albumul și/sau alte suporturi) aferente pachetului contractat, la data prezentei semnături.`);
  }
  if (includeCourier || includePersonalHandover) {
    const startMoment = includeCourier
      ? "recepționării efective a coletului cu materialele fizice"
      : "predării materialelor fizice, conform prezentului document";
    declClauses.push(`Înțeleg că, de la data ${startMoment}, am la dispoziție un termen de <span class="bold">${materialsReportWindowDays} zile</span> calendaristice pentru a verifica integritatea acestora și a semnala în scris eventuale neconformități, deteriorări sau lipsuri constatate. În lipsa unei sesizări în acest interval, materialele fizice se consideră acceptate ca fiind conforme.`);
  }
  declClauses.push(`Am fost informat(ă) că suporturile de stocare portabile (stick USB, card de memorie, hard disk extern) se pot defecta sau pot pierde datele stocate, de regulă după aproximativ <span class="bold">3–4 ani</span> de utilizare, fără avertisment prealabil. Prin urmare, îmi asum obligația de a realiza copii de rezervă (back-up) ale tuturor materialelor primite, în cel puțin <span class="bold">două locații diferite</span> (de exemplu: calculator personal, hard disk extern, serviciu de stocare în cloud). PRESTATORUL nu poate fi tras la răspundere pentru pierderea sau deteriorarea materialelor după predarea acestora.`);
  const declListHtml = declClauses.map((c) => `<li>${c}</li>`).join("\n");

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { background: #e8e8e8; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #111; line-height: 1.6; background: #e8e8e8; min-height: 100vh; padding: 32px 16px 48px; }
  .page { background: #fff; max-width: 794px; margin: 0 auto; padding: 28mm 20mm; box-shadow: 0 2px 16px rgba(0,0,0,0.18); }
  @media print {
    html, body { background: transparent; padding: 0; }
    .page { box-shadow: none; max-width: none; margin: 0; padding: 0; }
  }
  h1 { font-size: 14pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .underline { text-decoration: underline; }
  p { margin: 6px 0; }
  ol { padding-left: 20px; margin: 10px 0; }
  li { margin: 8px 0; }
  .sig-row { display: flex; gap: 60px; margin-top: 40px; }
  .sig-box { flex: 1; }
  .sig-label { font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 700; }
  .sig-name { font-size: 10pt; font-weight: 700; margin-top: 4px; }
  .sig-date { font-size: 9pt; color: #666; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 8pt; color: #999; text-align: center; }
  hr { border: none; border-top: 1px solid #999; margin: 8px 0; }
</style>
</head>
<body>
<div class="page">

<h1>Proces Verbal de Predare-Primire a Materialelor Foto/Video</h1>
<p class="center">Data: ${documentDate}</p>
<hr />

<p>Subsemnatul/Subsemnata, <span class="bold underline">${esc(handover.clientName as string || "________________________")}</span>, client pentru evenimentul <span class="bold">${esc(handover.eventType as string || "")}</span> din data <span class="bold">${eventDateFormatted}</span>, confirm prin prezentul document următoarele:</p>

<ol>
${declListHtml}
</ol>

<p>Am confirmat, prin bifarea căsuțelor de pe formularul de semnare electronică, înțelegerea termenelor de mai sus${includeDigitalLink ? " și a condițiilor de primire a link-ului digital" : ""}.</p>

<div class="sig-row">
  <div class="sig-box">
    <div class="sig-label">Client</div>
    ${handover.clientSignatureBase64
      ? `<img src="${handover.clientSignatureBase64}" style="max-width:220px;max-height:50px;display:block;margin-bottom:6px;" alt="Semnatura" />`
      : `<div style="height:50px;border-bottom:1px solid #333;margin-bottom:6px;"></div>`}
    <div class="sig-name">${esc(handover.clientName as string || "")}</div>
    ${handover.clientPhone || handover.clientEmail
      ? `<div class="sig-date">${esc([handover.clientPhone as string, handover.clientEmail as string].filter(Boolean).join(" • "))}</div>`
      : ""}
    <div class="sig-date">${signedDate}</div>
  </div>
</div>

<div class="footer">
  Document semnat electronic &nbsp;•&nbsp; ${new Date(toIsoString(handover.signedAt) ?? Date.now()).toLocaleString("ro-RO")} &nbsp;•&nbsp; IP: ${esc(handover.clientIp as string || "necunoscut")}
</div>

</div>
</body>
</html>`;

  return html;
}
