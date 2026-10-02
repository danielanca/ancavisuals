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
