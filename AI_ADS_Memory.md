# AI_ADS_MEMORY — Google Ads (DinIubire.ro)
# Context operațional despre contul de Google Ads, pentru Claude/Codex/alți agenți.
# NU este documentație publică. Actualizează după orice schimbare în cont.

## Conturi Google Ads (login: ancadaniel1994@gmail.com)
- **DinIubire.ro** — cont client, ID 899-590-2648 (uscid 982361173). Aici sunt campaniile reale (nuntă + înmormântări). #ACCOUNT
- **AncaVisuals Manager** — cont manager (MCC), ID 216-797-2478. #ACCOUNT

## Campania de înmormântări/funerare
- Nume: **"AncaVisuals | Search | Înmormântări"** — campaignId `24290468343`, în contul DinIubire.ro. #FUNERAL
- Tip: Rețeaua de căutare (Search). Stare: Activă, Eligibilă (Învață — strategia de licitare e în curs de învățare). #FUNERAL
- Buget: 101,96 RON/zi. Scor de optimizare: 94%. #FUNERAL
- Obiectiv de conversie: Trimiteți formulare de clienți potențiali (lead form). #FUNERAL
- Licitare: era "Maximizați numărul de conversii" → **schimbată pe 2026-09-28 la "Maximizați numărul de clicuri"** la cererea userului (campania avea 0 conversii/0 afișări, deci Max Conversions nu avea date să învețe). #FUNERAL #RECENT
- Targetare: **Vizate: Toate țările și teritoriile** (diaspora păstrată) **minus 27 de locații excluse în România** — setat pe 2026-09-28 la cererea userului. Limbă = Română. #FUNERAL #RECENT
  - Județe/zone RĂMASE targetate (Ardeal + Banat): Alba, Arad, Bihor, Bistrița-Năsăud, Brașov, Caraș-Severin, Cluj, Harghita, Hunedoara, Maramureș, Mureș, Satu Mare, Sălaj, Sibiu, Timiș.
  - Excluse (27 locații): București + județele Argeș, Bacău, Botoșani, Brăila, Buzău, Călărași, Constanța, Covasna, Dâmbovița, Dolj, Galați, Giurgiu, Gorj, Ialomița, Iași, Ilfov, Mehedinți, Neamț, Olt, Prahova, Suceava, Teleorman, Tulcea, Vaslui, Vâlcea, Vrancea.
  - Limita la est: Harghita (inclus), Covasna exclus. La vest: Arad + Timiș incluse. La sud: Sibiu, Brașov, Hunedoara incluse.
  - Tehnic: Google Ads nu are targetare la nivel de "regiune de dezvoltare" (Nord-Vest/Centru/Vest) căutabilă — s-a folosit exclude la nivel de județ individual, cu bază de includere "Toate țările" nemodificată (worldwide minus excluderile), astfel diaspora rămâne complet acoperită. #FUNERAL #PITFALL
- Cuvinte cheie cu potrivire amplă: Dezactivat. #FUNERAL
- Data început: 28 septembrie 2026, fără dată de sfârșit. #FUNERAL
- 1 singur grup de anunțuri: "Grupul de anunțuri 1". #FUNERAL
- **354 cuvinte cheie**, toate potrivire exactă ([exact match]), pattern hiper-local: combinații de tip
  "filmare inmormantare <oraș>", "fotograf inmormantare <oraș>", "foto video inmormantare <oraș>"
  pentru multe orașe (Cluj, Alba Iulia, Vulcan, Calan etc). #FUNERAL
- Multe din aceste cuvinte cheie apar ca **"Neeligibilă — Volum scăzut al căutărilor"** (search volume prea mic per oraș individual) — posibil ar fi mai eficient să se consolideze pe cuvinte cheie mai largi (ex: "filmare inmormantare Cluj" fără sufix oraș mic) sau potrivire frază în loc de exactă. #FUNERAL #PITFALL
- Performanță până acum (28 sept 2026): 0 afișări, 0 clicuri, 0 conversii, 0 RON cheltuit — campanie practic fără date încă. #FUNERAL

## Alte campanii relevante din DinIubire.ro
- Contul are 22 de campanii în total, majoritatea "Întreruptă" (paused) — multe sunt teste vechi (PMAX, Shopping, remarket) din 2024. #ACCOUNT
- **"AncaVisuals | Search"** — campanie activă separată (nuntă/foto general), 50 RON/zi, licitare "Maximizați numărul de clicuri", scor optimizare 93,2%, a cheltuit deja 35,53 RON. #ACCOUNT
- Majoritatea celorlalte campanii sunt axate pe fotografie/videografie de nuntă ("acte cununie", "DinIubire", "Fotograf Videograf Turda/Cluj" etc), nu pe funerare — contul e istoric un brand de nuntă (DinIubire = "din iubire"), iar campania de înmormântări e o extensie mai nouă. #ACCOUNT #PITFALL

## Audit 2026-10-02 (ultimele 7 zile, 25 sept – 1 oct)
- „AncaVisuals | Search” rulează pe **Căutare Google + Rețeaua de display** (extinderea Display activă). 130 clicuri / 346,77 RON / 0 conversii. #PITFALL
  - Display: 73 clicuri, 0,83 RON/clic, 60 RON, 151 plasări (site-uri de știri locale, felicitări etc.) → de aici CPC mediu „mic” (2,67 RON).
  - Căutare: 57 clicuri, ~5 RON/clic, 286 RON (ex. „fotograf nunta pret/sibiu/bistrita”, „foto video nunta alba iulia”).
- Pagini de destinație: `/oferta/olx` (124 clicuri) și `/oferte/olx` (5; 301 → `/oferta/olx`, OK).
- Site: `live_sessions` are 88 sesiuni Google Ads în aceeași perioadă (vizitatorii ajung); `siteVisits` pe `/oferta/olx` ≈ 82% bounce, mult trafic cu referrer `googlesyndication`/`doubleclick` (Display). `siteVisits` NU salvează gclid, doar utm. #ATTRIBUTION
- Alertă cont: „Soldul este aproape epuizat” (facturare preplătită) — când se termină, anunțurile se opresc.
- **2026-10-02: Rețeaua de display DEZACTIVATĂ** pe „AncaVisuals | Search” (campaignId `24155613782`) la cererea userului → Rețele = doar Rețeaua de căutare Google (parteneri de căutare erau deja debifați). Campania de înmormântări nu a fost verificată pentru Display. #RECENT
- Funnel „Verifică disponibilitatea” (live_sessions din 20 sept, 391 sesiuni): 32 sesiuni au verificat, TOATE rezultatele `available:true`; 4 WhatsApp, 2–3 formulare trimise, 0 lead confirmat. 8 verificări sunt pe data implicită (1 oct / 1 nov 2026, direct + desktop) — probabil teste sau click fără schimbarea datei. Mediana după verificare ≈ 2 min, apoi idle/plecare. Evenimentele din `live_sessions.events[]` au câmpul `name`, nu `type`. #ANALYTICS #PITFALL

## Raport 2026-10-02 („AncaVisuals | Search”, 23 sept – 2 oct)
- 177 clicuri / 12.598 afișări / 473,91 RON / CPC 2,68 / 0 conversii principale. Căutare ≈72 clicuri, ≈389 RON (CPC 5,40); Display ≈105 clicuri, ≈85 RON (CPC 0,81) — Display oprit pe 2 oct. #RECENT
- 2 cuvinte cheie cu POTRIVIRE AMPLĂ consumă ~77% din costul de căutare: `fotovideo nunta` (35 clic / 183 RON) și `fotograf de nunti` (21 / 115 RON). Exact-urile au scor de calitate 1–4/10, „Experiența paginii de destinație: Sub medie”; `[fotograf sibiu]`/`[fotograf nunta sibiu]` = „Eligibil (limitat) – scor scăzut”. #PITFALL
- Termeni: ~45% din clicurile de căutare sunt „alți termeni” (ascunși de Google). Vizibili: clicuri pe nume de concurenți (claudiu ardelean, gabriel filip photography, global photo guild, ioana porav, radu benjamin) și orașe din afara zonei (Timișoara, Brașov). #PITFALL
- Conversii: acțiunea „Persoană de contact” (ctId 7781605384, WhatsApp+telefon din `/oferta/:slug` via `fireAdsContactClickConversion`) e ACTIVĂ, 4 conversii în 10 zile, dar e SECUNDARĂ → nu apare în „Conversii”. Categoria „Persoană de contact” e în 0/19 campanii. Campania numără doar „Trimiteți formular” (0). „Verificare disponibilitate (micro)” = 7, secundară. #ATTRIBUTION
- Google Ads API: `.env` are `GOOGLE_ADS_CUSTOMER_ID=8995902648a` (literă în plus → INVALID_CUSTOMER_ID), codul folosește `v19` (404, scoasă), iar proiectul Cloud are acces doar „test accounts” → uploadul server-side de conversii nu funcționează. Trebuie cerut acces Explorer/Basic. #PITFALL
- **2026-10-02 (seara), la cererea userului:** `fotograf de nunti` (amplă) → ÎNTRERUPT; adăugat `[fotograf de nunti]` exact. Adăugate exacte Turda: `[fotograf nunta turda]`, `[fotograf de nunta turda]`, `[foto video nunta turda]`, `[videograf nunta turda]`, `[videograf turda]` (unele existau deja). Userul: NU adăuga nimic pentru Cluj. Aproape toate cuvintele „turda” sunt „Neeligibilă — volum scăzut”; doar `[fotograf turda]` are afișări. `fotovideo nunta` (amplă) rămâne activ. Lista de cuvinte cheie are un filtru salvat „Stare: Eligibilă, Eligibil (limitat)” care ascunde cuvintele întrerupte/în examinare — folosește căutarea din tabel. #RECENT #PITFALL
- **2026-10-02 (seara): Conversii offline „Client semnat” CONFIGURATE.** Încărcările s-au mutat în Instrumente → Manager de date → Conectați produsul → „Încărcare de fișiere” → Conversii → offline (pagina veche Conversii → Încărcări trimite doar acolo). Schema Data Manager: anteturi în PRIMUL rând (fără `Parameters:TimeZone`), dată cu offset (`2026-10-02T19:10:00+03:00`), coloane `Conversion action,GCLID,Conversion date and time,Conversion value`; moneda nemapată = moneda contului (RON). Acțiunea „Client semnat”: categorie „Client potențial convertit”, PRINCIPALĂ, inclusă în obiectivele contului, valori diferite (implicit 1600 RON), numărare „Una”, 90 zile, atribuire bazată pe date. Primul client: gclid din `/oferta/olx` (vizită 2 oct 18:38, contract 19:10, 1600 RON), fișier `~/Desktop/client-semnat.csv`, conexiunea în Data Manager se numește `client-semnat.csv`. #RECENT #ATTRIBUTION

## Verificare 2026-10-03 („AncaVisuals | Search”)
- Un singur grup de anunțuri și un singur RSA, cu **Puterea anunțului: Slabă**; titluri de tipul „Fotograf si Videograf | Foto si Video Nunta | Fotograf Transilvania Ardeal”. Scor optimizare 92,4%. Datele tot 23 sept – 2 oct (178 clicuri / 477 RON / 0 conv. principale). Google recomandă din nou Display + parteneri de căutare — NU aplica (Display a fost oprit intenționat). #RECENT #PITFALL
- Primul client semnat din Ads (2 oct, 1600 RON, via `/oferta/olx`) a cerut **foto pentru BOTEZ**, deși campania are doar cuvinte de nuntă → trafic generic („fotograf sibiu”, „caut fotograf”, „foto video”) aduce și botezuri. Nu tăia orbește termenii generici. #ATTRIBUTION #PITFALL
- **2026-10-03 (azi, la cererea userului):** adăugate negative la nivel de campanie pe „AncaVisuals | Search”, potrivire expresie: `"jigovan"`, `"julius paul"` (concurenți apăruți în termenii de căutare). Lista de negative: 33 → 35. Restul propunerilor (studio, photo shoot, near me, fotografo, cameraman; `fotovideo nunta` → expresie) NU au fost aplicate încă. #RECENT
- Ziua de 3 oct (parțial): 47 afișări / 3 clicuri / 8,34 RON / 0 conversii, toate clicurile din `fotovideo nunta` (amplă); 0 clicuri de pe mobil deși 75% din afișări au fost pe mobil. #RECENT
- Pe zile 1–3 oct (doar „AncaVisuals | Search” a cheltuit; „Înmormântări” = 0 afișări în toate 3 zilele): 1 oct 4.739 af / 36 clic / 52,98 RON; 2 oct 3.657 / 38 / 44,67; 3 oct (parțial) 55 / 7 / 19,03. 0 conversii principale; „Client semnat” (încărcat 2 oct) încă nu apare în coloana Conversii. Căderea de afișări pe 3 oct = efectul opririi Display. #RECENT
