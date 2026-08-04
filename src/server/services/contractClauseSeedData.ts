// Migrated 1:1 from the hardcoded clause text that used to live inline in buildContractHTML()
// (src/server/services/pdf.generator.ts). This is the shared ("all") baseline library —
// admin can add per-event-type exceptions on top of this from the "Șabloane contract" page.
//
// Two clauses that used to interleave conditional lines inside one body are split into several
// rows sharing the same groupKey, so each line can be toggled independently:
//   - "Termene standard de predare" → termene-foto / termene-video / termene-photobooth / termene-general
//   - "Răspunderea prestatorului și limitări" → raspundere-baza / raspundere-fotovideo / raspundere-photobooth
// The VideoBooth 360° safety block (previously nested inside the photobooth clause, conditional
// on hasVideobooth) becomes its own independently-toggleable row instead of being folded in
// unconditionally, preserving the original behavior exactly.
// "Drepturi asupra imaginilor foto/video" becomes a mutex pair (public vs. confidențialitate),
// auto-selected by privateClient.

export interface SeedClause {
  key: string;
  title: string;
  bodyTemplate: string;
  appliesTo: string;
  order: number;
  groupKey: string | null;
  conditionTag: string | null;
  mutexGroup: string | null;
}

export const SEED_DEFAULT_CLAUSES: SeedClause[] = [
  {
    key: "exhaustivitate",
    title: "Materiale și servicii incluse — clauză de exhaustivitate",
    appliesTo: "all",
    order: 10,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `
      <p>PRESTATORUL este obligat să ofere BENEFICIARULUI exclusiv materialele, accesoriile, albumele și celelalte servicii care sunt menționate expres în prezentul contract (inclusiv în tabelul de mai sus).</p>
      <p>Orice discuții, promisiuni sau înțelegeri purtate verbal, telefonic sau prin mesaje, care nu sunt consemnate în scris în prezentul contract, nu constituie o obligație contractuală și nu pot fi invocate de BENEFICIAR ca temei pentru solicitarea lor.</p>
      <p>Dacă BENEFICIARUL a convenit cu PRESTATORUL asupra unui material, accesoriu sau serviciu suplimentar care nu apare în prezentul contract, este obligația BENEFICIARULUI de a solicita PRESTATORULUI modificarea în scris a contractului, înainte de eveniment. În lipsa acestei modificări scrise, comunicarea verbală nu reprezintă o garanție a primirii respectivului material, accesoriu sau serviciu.</p>
      <p>Prin semnarea prezentului contract, BENEFICIARUL confirmă că a citit și a înțeles pe deplin prezenta clauză și este de acord că nu poate ridica nicio pretenție față de PRESTATOR pentru materiale, accesorii sau servicii care nu sunt menționate expres în prezentul contract, indiferent de eventualele discuții purtate verbal, telefonic sau prin mesaje.</p>
    `,
  },
  {
    key: "foto-specs",
    title: "Produsul livrat — specificații fotografice",
    appliesTo: "all",
    order: 20,
    groupKey: null,
    conditionTag: "hasFoto",
    mutexGroup: null,
    bodyTemplate: `
      <p>PRESTATORUL se angajează să surprindă toate momentele cheie ale evenimentului, fără un număr fix prestabilit de cadre. Numărul minim garantat de fotografii finale editate este de <span class="bold">600 fotografii</span>, la rezoluție înaltă (full resolution). De regulă, la evenimente complete, livrăm între <span class="bold">900 și 1.200 de fotografii</span> editate.</p>
      <p><span class="bold">Stilul fotografic:</span> documentar — surprindem momentele natural, fără punere în scenă forțată.</p>
      <p>Fotografiile finale se livrează în format digital, pe platformă online securizată, accesibilă exclusiv BENEFICIARULUI.</p>
    `,
  },
  {
    key: "video-specs",
    title: "Produsul livrat — specificații video",
    appliesTo: "all",
    order: 30,
    groupKey: null,
    conditionTag: "hasVideo",
    mutexGroup: null,
    bodyTemplate: `
      <p>Materialele video vor fi realizate la rezoluție <span class="bold">4K</span>. <span class="bold">Filmul lung</span> (after movie complet) va avea o durată cuprinsă între <span class="bold">4 și 6 ore</span>, realizat în stil documentar/vlog — filmat natural, fără intervenții artistice.</p>
      <p><span class="bold">Videoul scurt</span> (teaser), acolo unde este inclus în pachet, va fi realizat în stil cinematic/artistic, cu montaj profesional și coloană sonoră adecvată.</p>
      <p>Materialele video finale se livrează în format digital, pe platformă online securizată, accesibilă exclusiv BENEFICIARULUI.</p>
    `,
  },
  {
    key: "photobooth-specs",
    title: "Produsul livrat — specificații fotocabină / photo booth",
    appliesTo: "all",
    order: 40,
    groupKey: null,
    conditionTag: "hasPhotobooth",
    mutexGroup: null,
    bodyTemplate: `
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
    `,
  },
  {
    key: "videobooth-360-siguranta",
    title: "Clauză VideoBooth 360° — Limitarea răspunderii privind siguranța participanților",
    appliesTo: "all",
    order: 41,
    groupKey: null,
    conditionTag: "hasVideobooth",
    mutexGroup: null,
    bodyTemplate: `
      <div style="margin:10px 0;padding:10px 14px;background:#fff8f0;border-left:3px solid #d97706;font-size:9.5pt;color:#444;line-height:1.6;">
        PRESTATORUL va delimita zona de operare a echipamentului rotativ cu <span class="bold">stâlpi și bandă de delimitare</span>, pentru a restricționa accesul neautorizat în aria de rotație a brațului aparatului.<br/><br/>
        BENEFICIARUL înțelege și acceptă că echipamentul VideoBooth 360° este un dispozitiv cu element rotativ care poate cauza accidente în cazul în care persoane — în special copii — pătrund în zona de protecție delimitată în timpul funcționării acestuia.<br/><br/>
        <span class="bold">PRESTATORUL nu își asumă nicio răspundere pentru accidentele, rănirile sau prejudiciile cauzate persoanelor care depășesc zona de delimitare în timpul funcționării echipamentului.</span> Supravegherea copiilor și a participanților în apropierea echipamentului rotativ este responsabilitatea exclusivă a BENEFICIARULUI și/sau a părinților/însoțitorilor acestora.<br/><br/>
        Prin semnarea prezentului contract, BENEFICIARUL confirmă că a luat la cunoștință această clauză și că va informa invitații cu privire la normele de siguranță în zona VideoBooth 360°.
      </div>
    `,
  },
  {
    key: "drepturi-imagine-public",
    title: "Drepturi asupra imaginilor foto/video",
    appliesTo: "all",
    order: 50,
    groupKey: null,
    conditionTag: "hasPhotoVideoAndNotPrivate",
    mutexGroup: "drepturi-imagine",
    bodyTemplate: `<p>PRESTATORUL își rezervă dreptul de a utiliza imaginile foto și/sau video realizate în cadrul acestui Contract pentru promovarea activității sale, inclusiv pe rețelele de socializare, portofoliu online, marketing, târguri sau concursuri. Imaginile vor fi alese de PRESTATOR dintre cele mai reprezentative din perspectivă artistică. În cazul în care BENEFICIARUL dorește confidențialitate totală asupra materialelor, acesta trebuie să notifice PRESTATORUL în scris, anterior semnării contractului.</p>`,
  },
  {
    key: "drepturi-imagine-privat",
    title: "Drepturi asupra imaginilor foto/video",
    appliesTo: "all",
    order: 51,
    groupKey: null,
    conditionTag: "hasPhotoVideoAndPrivate",
    mutexGroup: "drepturi-imagine",
    bodyTemplate: `<p><span class="bold">Confidențialitate totală:</span> La solicitarea expresă a BENEFICIARULUI, toate materialele foto și video realizate în cadrul acestui Contract sunt strict confidențiale și destinate exclusiv uzului personal al acestuia. PRESTATORUL nu va publica, distribui sau utiliza în niciun scop public (portofoliu, social media, marketing, târguri, concursuri sau orice alt canal) niciuna dintre imaginile sau materialele video rezultate. Această clauză este obligatorie și are caracter permanent.</p>`,
  },
  {
    key: "stil-artistic",
    title: "Acceptarea stilului artistic",
    appliesTo: "all",
    order: 60,
    groupKey: null,
    conditionTag: "hasPhotoVideo",
    mutexGroup: null,
    bodyTemplate: `
      <p>BENEFICIARUL declară că a vizualizat în prealabil portofoliul PRESTATORULUI și este pe deplin de acord cu stilul artistic în care acesta realizează fotografiile și/sau materialele video, astfel cum sunt descrise în prezentul contract (stil documentar, cinematic/artistic, editare, culori, montaj etc.).</p>
      <p>BENEFICIARUL declară că nu va avea pretenții de restituire materială sau financiară motivate de nemulțumiri legate de stilul artistic/creativ al fotografiilor și/sau materialelor video livrate, acest stil fiind cunoscut și acceptat anterior semnării prezentului contract.</p>
    `,
  },
  {
    key: "termene-foto",
    title: "Termene standard de predare",
    appliesTo: "all",
    order: 70,
    groupKey: "termene-predare",
    conditionTag: "hasFoto",
    mutexGroup: null,
    bodyTemplate: `
      <p>Fotografii preview: până la 20 fotografii editate în termen de 7 (șapte) zile calendaristice.</p>
      <p>Restul materialelor foto finale: în termen de 30 (treizeci) de zile calendaristice.</p>
    `,
  },
  {
    key: "termene-video",
    title: "Termene standard de predare",
    appliesTo: "all",
    order: 71,
    groupKey: "termene-predare",
    conditionTag: "hasVideo",
    mutexGroup: null,
    bodyTemplate: `<p>Materiale video finale (teaser/film/after movie): în termen de 60 (șaizeci) de zile calendaristice.</p>`,
  },
  {
    key: "termene-photobooth",
    title: "Termene standard de predare",
    appliesTo: "all",
    order: 72,
    groupKey: "termene-predare",
    conditionTag: "hasPhotobooth",
    mutexGroup: null,
    bodyTemplate: `<p>Materialele digitale din fotocabină se livrează în termen de 24 de ore de la eveniment, pe suport digital agreat cu BENEFICIARUL.</p>`,
  },
  {
    key: "termene-general",
    title: "Termene standard de predare",
    appliesTo: "all",
    order: 73,
    groupKey: "termene-predare",
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `<p>Toate materialele se livrează exclusiv după achitarea integrală a sumelor datorate conform prezentului contract.</p>`,
  },
  {
    key: "backup-responsabilitate",
    title: "Responsabilitatea beneficiarului privind stocarea materialelor",
    appliesTo: "all",
    order: 80,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `
      <p>BENEFICIARUL este responsabil de efectuarea unui <span class="bold">back-up</span> (copie de rezervă a fișierelor, stocată pe un dispozitiv propriu sau pe un serviciu de stocare în cloud) al tuturor materialelor — fotografii și/sau materiale video — primite de la PRESTATOR.</p>
      <p>PRESTATORUL nu poate fi tras la răspundere pentru pierderea, deteriorarea sau indisponibilitatea materialelor după livrarea acestora, indiferent de cauza producerii acestora, inclusiv ca urmare a trecerii timpului, defecțiunilor tehnice sau expirării platformei de livrare.</p>
    `,
  },
  {
    key: "forta-majora",
    title: "Forța majoră",
    appliesTo: "all",
    order: 90,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `<p>Forța majoră apără de răspundere partea care o invocă în scris, în termen de 5 zile de la data producerii acesteia. Prin caz de forță majoră se înțeleg împrejurările neprevăzute și inevitabile pentru una dintre părți, incluzând dar nelimitându-se la: accident, rănire, boală, incendiu, furt, urgență familială (rudele de gradul întâi și doi) sau orice alt act sau situație dincolo de controlul părților, recunoscut de lege ca fiind un caz de forță majoră.</p>`,
  },
  {
    key: "conditii-atmosferice",
    title: "Condiții atmosferice",
    appliesTo: "all",
    order: 100,
    groupKey: null,
    conditionTag: "hasPhotoVideo",
    mutexGroup: null,
    bodyTemplate: `<p>PRESTATORUL poate refuza fotografierea și/sau filmarea anumitor evenimente atunci când condițiile atmosferice (temperatură, umiditate, precipitații) pun în pericol aparatura utilizată.</p>`,
  },
  {
    key: "raspundere-baza",
    title: "Răspunderea prestatorului și limitări",
    appliesTo: "all",
    order: 110,
    groupKey: "raspundere-prestator",
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `<p>În cazul în care PRESTATORUL nu realizează din vina sa serviciile care fac obiectul acestui Contract, el este responsabil în fața BENEFICIARULUI numai pentru sumele plătite de către acesta, neintrând în discuție orice cheltuieli făcute între timp de PRESTATOR.</p>`,
  },
  {
    key: "raspundere-fotovideo",
    title: "Răspunderea prestatorului și limitări",
    appliesTo: "all",
    order: 111,
    groupKey: "raspundere-prestator",
    conditionTag: "hasPhotoVideo",
    mutexGroup: null,
    bodyTemplate: `<p>PRESTATORUL nu poate fi tras la răspundere pentru: calitatea fotografiilor/filmărilor afectată de condiții de iluminat insuficient sau necontrolabil, spații aglomerate care limitează accesul, momente neacoperite ca urmare a restricțiilor impuse de oficianți sau a nepunctualității participanților.</p>`,
  },
  {
    key: "raspundere-photobooth",
    title: "Răspunderea prestatorului și limitări",
    appliesTo: "all",
    order: 112,
    groupKey: "raspundere-prestator",
    conditionTag: "hasPhotobooth",
    mutexGroup: null,
    bodyTemplate: `<p>PRESTATORUL nu poate fi tras la răspundere pentru defecțiuni tehnice generate de factori externi (întreruperi de curent, defecțiuni ale rețelei electrice din locație). În astfel de situații, va depune toate diligențele pentru remedierea rapidă.</p>`,
  },
  {
    key: "returnare-suma",
    title: "Returnarea sumei pentru un serviciu nefuncțional",
    appliesTo: "all",
    order: 120,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `
      <p>În situația în care un anumit serviciu contractat (de exemplu: fotocabină / photo booth, VideoBooth 360°, QR Moments) nu poate funcționa la locul evenimentului, inclusiv din cauze care nu se datorează culpei PRESTATORULUI (de exemplu: lipsa curentului electric la locație, restricții impuse de locație sau alte cauze externe), PRESTATORUL va returna BENEFICIARULUI suma achitată aferentă serviciului respectiv, conform prețului acestuia menționat în tabelul de la secțiunea "Conținutul serviciului și prețul".</p>
      <p>Această clauză privește exclusiv suma achitată pentru serviciul care nu a funcționat și nu afectează celelalte servicii contractate, care se derulează în continuare conform prezentului contract.</p>
    `,
  },
  {
    key: "contactare-prealabila",
    title: "Obligația de contactare prealabilă",
    appliesTo: "all",
    order: 130,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `
      <p>BENEFICIARUL are obligația de a contacta PRESTATORUL cu cel puțin 7 (șapte) zile calendaristice înainte de data evenimentului, printr-un mijloc de comunicare confirmat (telefon, mesaj scris, e-mail sau alt canal agreat), în scopul reconfirmării detaliilor evenimentului.</p>
      <p>Nerespectarea acestei obligații îl exonerează pe PRESTATOR de răspunderea pentru eventuale neconcordanțe sau imposibilitatea prestării serviciilor în condițiile stabilite.</p>
    `,
  },
  {
    key: "itinerariu",
    title: "Itinerariul evenimentului",
    appliesTo: "all",
    order: 140,
    groupKey: null,
    conditionTag: "hasPhotoVideo",
    mutexGroup: null,
    bodyTemplate: `
      <p>BENEFICIARUL are obligația de a transmite PRESTATORULUI, cu cel puțin 4–5 zile calendaristice înainte de eveniment (prin WhatsApp sau în scris), programul complet al zilei (itinerariul), incluzând orele aproximative pentru fiecare moment: domiciliul miresei, domiciliul mirelui, locația ceremoniei civile și/sau religioase, locația recepției, precum și orice alte momente relevante.</p>
      <p>BENEFICIARUL va ține cont de timpii de deplasare între locații. Netransmiterea itinerariului cu cel puțin 4–5 zile înainte îl exonerează pe PRESTATOR de răspunderea pentru momentele fotografice/video neacoperite.</p>
      <div style="margin:8px 0;padding:10px 14px;background:#f7f7f7;border-left:3px solid #bbb;font-size:9.5pt;color:#555;line-height:1.6;">
        <strong>Notă informativă — Cum se calculează itinerariul:</strong><br/>
        Luați în considerare: ora coafurii/machiajului → pregătire completă → deplasare la mire → cununie civilă → cununie religioasă → recepție. Adăugați minim 20–30 de minute tampon între locații. Fotograful/videograful trebuie să ajungă înaintea voastră la fiecare locație.
      </div>
    `,
  },
  {
    key: "masa-echipei",
    title: "Masa echipei prestatorului",
    appliesTo: "all",
    order: 150,
    groupKey: null,
    conditionTag: "hasPhotoVideo",
    mutexGroup: null,
    bodyTemplate: `<p>BENEFICIARUL are obligația de a asigura membrilor echipei PRESTATORULUI prezenți la eveniment (fotograf/videograf) masă inclusă, similar invitaților, pe durata desfășurării evenimentului.</p>`,
  },
  {
    key: "politica-anulare",
    title: "Politica de anulare",
    appliesTo: "all",
    order: 160,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `
      <p><span class="bold">Abandon din partea Prestatorului:</span> Dacă PRESTATORUL renunță unilateral cu mai mult de 30 de zile înainte de eveniment, returnează integral avansul/arvuna încasat(ă). În caz de forță majoră documentat (accident/spitalizare/deces), avansul este returnat integral.</p>
      <p><span class="bold">Abandon din partea Beneficiarului:</span> Avansul/arvuna este nereturnabil(ă) indiferent de momentul abandonului. Materialele se predau numai după achitarea integrală a sumelor datorate.</p>
    `,
  },
  {
    key: "gdpr",
    title: "Protecția datelor personale (GDPR)",
    appliesTo: "all",
    order: 170,
    groupKey: null,
    conditionTag: null,
    mutexGroup: null,
    bodyTemplate: `<p>PRESTATORUL prelucrează datele cu caracter personal ale BENEFICIARULUI (nume, adresă, serie și număr CI, semnătură electronică, adresă de e-mail, telefon) exclusiv în scopul încheierii și executării prezentului contract, în conformitate cu Regulamentul (UE) 2016/679 (GDPR). Datele sunt stocate electronic în condiții de securitate și nu vor fi transmise unor terți, cu excepția obligațiilor legale. BENEFICIARUL confirmă că a luat la cunoștință și este de acord cu prelucrarea datelor sale în scopurile menționate și că dispune de dreptul de acces, rectificare și ștergere a datelor, prin solicitare scrisă adresată PRESTATORULUI.</p>`,
  },
];
