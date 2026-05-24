# AI_MEMORY — ancavisuals
# Context operațional shared între Claude, Codex și orice alt agent AI.
# NU este documentație pentru useri.
# Actualizează după orice schimbare structurală.
# Dacă faci schimbări relevante în repo, notează-le în #RECENT.

## CONVENȚIE FIȘIER — citește asta primul

Acest fișier este structurat cu tag-uri `#TAG` la finalul fiecărei linii relevante.
Scopul: orice agent poate extrage doar secțiunea de care are nevoie cu un singur `rg`,
fără să citească tot fișierul și fără să consume tokeni inutil.

**Regulă pentru orice agent care actualizează acest fișier:**
- Fiecare linie de informație utilă trebuie să aibă `#TAG` la final (ex: `#BLOG`, `#PITFALL`, `#RECENT`)
- Când adaugi o secțiune nouă, adaug-o și în RG CHEATSHEET de mai jos, cu comanda exactă
- Intrările în `#RECENT` se adaugă sus în secțiune (cele mai noi primele)
- Nu șterge tag-urile existente când editezi o linie — sunt indexul fișierului

**De ce rg și nu grep?**
`rg` (ripgrep) este mai rapid și mai practic pe codebase-uri mari.
Același principiu se aplică și pentru căutări în codul sursă:
- `rg -n "pattern" src` în loc de `grep -rn`
- `rg --files | rg "pattern"` pentru găsit fișiere după nume

---

## RG CHEATSHEET — caută fără să citești tot fișierul

#   rg -n "#STACK"    AI_MEMORY.md   → stack și entry points
#   rg -n "#CMD"      AI_MEMORY.md   → comenzi utile
#   rg -n "#PITFALL"  AI_MEMORY.md   → capcane cunoscute
#   rg -n "#BLOG"     AI_MEMORY.md   → sistemul de blog
#   rg -n "#SSR"      AI_MEMORY.md   → comportament SSR
#   rg -n "#LOCATION" AI_MEMORY.md   → SEO pagini per oraș/serviciu
#   rg -n "#NOTIFY"   AI_MEMORY.md   → notificări și trigger events
#   rg -n "#MEDIA"    AI_MEMORY.md   → media download
#   rg -n "#QR"       AI_MEMORY.md   → QR Moments
#   rg -n "#ENV"      AI_MEMORY.md   → variabile de mediu
#   rg -n "#CI"       AI_MEMORY.md   → CI / GitHub Actions
#   rg -n "#THEME"    AI_MEMORY.md   → culori și constante UI
#   rg -n "#DEBUG"    AI_MEMORY.md   → debugging rapid
#   rg -n "#RECENT"   AI_MEMORY.md   → modificări recente
#   rg -n "#ADMIN"    AI_MEMORY.md   → admin dashboard, events, contracte
#   rg -n "#WH"       AI_MEMORY.md   → Wedding Hub — miri, invitați, mese, RSVP

---

## STACK #STACK

#STACK  Nume: ancavisuals
#STACK  Limbaj: TypeScript
#STACK  Frontend: React 18 + Vite (SSR mode)
#STACK  Backend: Express
#STACK  Teste: Vitest
#STACK  Stilizare: Tailwind CSS + SCSS
#STACK  DB/Storage: Firebase + Firebase Admin
#STACK  Entry server: server.ts
#STACK  Entry SSR client: src/client/entry-server.tsx
#STACK  Onboarding agent: AGENTS.md
#STACK  Routes client: src/client/routes/publicRoutes.tsx
#STACK  src/client       → pagini React, componente, hooks, SSR entry
#STACK  src/server       → routes, controllers, services, notificări, utils
#STACK  tests/vitest     → teste Vitest (client + server)
#STACK  tests/e2e        → teste Playwright E2E
#STACK  reports/         → artefacte generate (coverage, playwright, test-results)
#STACK  public           → asset-uri statice
#STACK  data/blog        → articole Markdown pentru blog
#STACK  data/            → fișiere de date statice (blogManifest.ts, prices.json etc.)

---

## COMENZI #CMD

#CMD  dev:                npm run dev
#CMD  dev server:         npm run dev:server
#CMD  typecheck:          npm run typecheck
#CMD  test:               npm test
#CMD  test:e2e:           npm run test:e2e
#CMD  test:e2e headed:    npm run test:e2e:headed
#CMD  test:e2e report:    npm run test:e2e:report
#CMD  coverage open:      npm run coverage:open
#CMD  build:              npm run build
#CMD  înainte de build:    npm install apoi npm run build, ca să se prindă dependențe noi sau lockfile changes în scripts #CMD
#CMD  lint:               npm run lint
#CMD  pm2 serve:          npm run serve:pm2
#CMD  fișiere după pat:   rg --files src | rg 'pattern'
#CMD  referințe în cod:   rg -n "pattern" src server.ts
#CMD  fișiere git:        git ls-files | rg 'pattern'
#CMD  stare repo:         git status --short

---

## BLOG #BLOG

#BLOG  Articole:       data/blog/*.md  (frontmatter YAML + Markdown)
#BLOG  Index static:   data/blogManifest.ts  ← sursă de adevăr pentru SSR meta tags
#BLOG  Utilitar:       src/server/utils/blogUtils.ts
#BLOG  API route:      src/server/routes/blog.routes.ts  → GET /api/blog, GET /api/blog/:slug
#BLOG  Pagina listă:   src/client/pages/Blog/BlogList.tsx  → /blog
#BLOG  Pagina post:    src/client/pages/Blog/BlogPost.tsx  → /blog/:slug
#BLOG  Accent color:   src/client/utils/theme.ts  → constanta ACCENT
#BLOG  Adaugă articol: 1) data/blog/<slug>.md cu frontmatter  2) intrare în blogManifest.ts

---

## SSR #SSR

#SSR  renderToString este SINCRON — fetch async nu funcționează în SSR
#SSR  Soluție: importă static din TS/JSON (ex: blogManifest.ts, locationData.ts)
#SSR  Dev: Vite în middleware mode, transformă index.html la fiecare request
#SSR  Prod: servește dist/client, entry SSR din dist/server/entry-server.js
#SSR  Helmet (react-helmet-async) funcționează în SSR — titlu/meta sunt în HTML-ul inițial

---

## LOCATION SEO #LOCATION

#LOCATION  Date:     src/client/pages/LocationSEO/locationData.ts
#LOCATION  Pagina:   src/client/pages/LocationSEO/LocationPage.tsx
#LOCATION  Rute:     generate programatic în publicRoutes.tsx din ALL_LOCATION_ROUTES
#LOCATION  Pattern:  /foto-video-{serviciu}-{oras}, /fotograf-{serviciu}-{oras} etc.

---

## NOTIFICĂRI / TRIGGER EVENTS #NOTIFY

#NOTIFY  Template email:  src/server/notifications/templates/triggerTemplate.ts
#NOTIFY  Mailer:          src/server/notifications/mailer.ts
#NOTIFY  Controller:      src/server/controllers/triggerEvent.controller.ts
#NOTIFY  Funcții:         src/server/functions/eventFuncs.ts
#NOTIFY  IP util:         src/server/utils/ipinfo.ts  ← casing exact, nu ipInfo

---

## MEDIA DOWNLOAD #MEDIA

#MEDIA  Pagina:     src/client/pages/MediaDownload/MediaAlbumPage.tsx
#MEDIA  Onboarding: src/client/pages/MediaDownload/Onboardingwizard.tsx  ← casing exact
#MEDIA  Galerie album: grid-ul browse rămâne pe `photos_preview`/WebP pentru performanță, dar lightbox-ul cu navigare stânga/dreapta trebuie să folosească `originalPhoto`; mapează preview→original după basename, nu după extensie, fiindcă preview-ul poate fi `.webp` iar originalul `.jpg/.jpeg/.png` #MEDIA

---

## QR MOMENTS #QR

#QR  Route:   src/server/routes/QRMoment.routes.ts  ← casing exact
#QR  Route nou: src/server/routes/qrMoments.routes.ts  ← flux public + galerie + admin QR Moments
#QR  Service: src/server/services/qrMoment.service.ts
#QR  Admin UI: src/client/features/admin/components/QRMomentsAdminPage.tsx  → /admin/qr-moments
#QR  Debugging upload: QRMomentsPage raportează explicit eșecurile de register/upload către `/api/monitoring/client-error`, cu context (eventSlug, guestId, fișiere, userAgent, ultimele console warn/error); monitoring trimite email imediat pentru mesajele prefixate `[QR DEBUG]`. #QR #DEBUG
#QR  Teste:   tests/vitest/server/services/QRMoment.services.test.ts

---

## TEMA / UI #THEME

#THEME  Accent principal: amber-200 (variante /70, /80 pentru muted)
#THEME  Constanta ACCENT: src/client/utils/theme.ts  ← folosește în loc de clase hardcodate
#THEME  Folosit în: BlogList.tsx, BlogPost.tsx — de extins treptat

---

## VARIABILE DE MEDIU #ENV

#ENV  Fișier: .env în root
#ENV  Firebase/Admin: necesare în prod, pot lipsi în teste
#ENV  IPINFO_TOKEN: opțional — fetchIpInfo returnează null dacă lipsește

---

## CI / GITHUB ACTIONS #CI

#CI  Workflow:  .github/workflows/nodejs.yml
#CI  Versiuni:  actions/checkout@v4, actions/setup-node@v4
#CI  Node:      22 în workflow și `.nvmrc`
#CI  Jobs:      lint, typecheck, test, build ca joburi separate în GitHub Actions
#CI  Atenție:   CI rulează pe Linux — case sensitivity diferă față de macOS

---

## PUSH / PR CHECKLIST #READY

#READY  Când userul cere „pregătește pentru push/PR”, agentul trebuie să consemneze schimbările relevante în AI_MEMORY.md
#READY  Când userul cere „pregătește pentru push/PR”, agentul trebuie să ruleze validările relevante înainte de verdict
#READY  Minim recomandat pentru verdict „ready”: npm run typecheck && npm test && npm run build
#READY  Dacă există script de lint funcțional, rulează și: npm run lint
#READY  Nu spune „gata de push” dacă build-ul nu a fost rulat pentru schimbări care pot afecta bundling, asset paths, SSR sau imports
#READY  Typecheck și testele nu sunt suficiente pentru erori Vite/Rollup; build-ul trebuie rulat explicit
#READY  În răspunsul final, agentul trebuie să spună clar ce comenzi au trecut și ce nu a fost rulat

---

## ADMIN DASHBOARD #ADMIN

#ADMIN  Rută principală:      /admin → Dashboard (RequireAuth)
#ADMIN  Colecție events:      Firestore `adminEvents` — statusuri: lead | tentativ | confirmat | finalizat | anulat
#ADMIN  Colecție contracte:   Firestore `contracts` — statusuri: draft | sent | signed | expired | anulat
#ADMIN  eventDate nullable:   `ClientEvent.eventDate` este `Date | null` — lead-urile pot fi fără dată
#ADMIN  Lead flow:            AddLeadModal → status "lead" → butoane rapide Tentativ/Confirmă/Renunță în EventCard
#ADMIN  EventList tabs:       Lead-uri (lead+tentativ) | Viitoare (confirmat, dată>=azi) | Trecute | Arhivă (anulat)
#ADMIN  EventList default:    Tab implicit = "Viitoare" (nu Lead-uri)
#ADMIN  Contract routes:      src/server/routes/contracts.routes.ts
#ADMIN  Contract PDF:         src/server/services/pdf.generator.ts (Puppeteer)
#ADMIN  Contract email:       src/server/notifications/templates/contractEmail.ts
#ADMIN  Contract storage:     Firebase Storage `contracts/` folder, signed URL valid până 2099
#ADMIN  Contract editare:     PATCH /api/contracts/:id — blocat dacă status === "signed"; EditContractPage la /admin/contracts/:id/edit
#ADMIN  Contract-event link:  Bidirectional — `contractId` pe eveniment, `eventId` pe contract; POST /api/contracts acceptă eventId și actualizează adminEvents
#ADMIN  Contract fizic:       `attachmentUrls: string[]` pe event (poze/scan) = echivalent cu a avea contract; ascunde "Creează contract", arată C✓
#ADMIN  Admin events routes:  src/server/routes/adminEvents.routes.ts
#ADMIN  Admin calendar:       src/server/routes/adminCalendar.routes.ts → citește bookedDates.json din Storage
#ADMIN  Semnătură canvas:     prestatorSignatureBase64 (admin) + clientSignatureBase64 (client) în Firestore
#ADMIN  Zile ocupate (public): GET /api/booked-dates → src/server/routes/publicBookedDates.routes.ts → adminEvents
#ADMIN  bookedDates.json:     DEFUNCT — nu mai e sursa de adevăr pentru disponibilitate
#ADMIN  Settings Firestore:   `settings/admin` doc conține `goals`, `currency`, `exchangeRate`
#ADMIN  GoalCard:             Editabil (EUR target + date range); 6-luni are `editableRange` prop pentru date picker; titlu "Goal Personalizat"
#ADMIN  FinancialSummary:     Componentă nouă — filtrează confirmat+finalizat, an curent; arată avans încasat, urmează să primești, detaliu pe evenimente
#ADMIN  Financiar > Extrase:  tab nou în `FinancialPage` — upload PDF/imagine extras bancar, AI extrage toate tranzacțiile și încearcă justificare automată prin `invoices` + `expenses`; backend: `src/server/routes/bankStatements.routes.ts`, colecție Firestore `bankStatements` #ADMIN
#ADMIN  MultiFileDropZone:    Componentă nouă — upload multiple fișiere cu thumbnails imagini, progress per fișier, delete individual
#ADMIN  AddLeadModal pricing: Include câmpuri total/avans/rest cu calcul automat; checkbox "avans deja încasat"; backend citește pricing direct din body
#ADMIN  Fiscalizare eveniment: `adminEvents.fiscalized` este boolean; default = `false` (nefiscalizat), iar EventCard/EventList expun marker + toggle + filtru `Toate | Fiscalizate | Nefiscalizate` #ADMIN
#ADMIN  Detalii bancare:      pagină dedicată `/admin/bank-details`; salvează `settings/admin.bankDetails = { beneficiaryName, iban }` și injectează valorile în contracte/PDF/public sign page când `paymentMethod === "Transfer bancar"` #ADMIN
#ADMIN  Conturi admin:        `/admin/accounts` poate trimite invitații per album către conturi Firebase existente; colecția Firestore `collaboratorInvites` programează reminder-e automate la 24h, +72h, +7 zile, +14 zile și +30 zile, apoi se opresc. Invitația se închide doar pentru albumul respectiv când colaboratorul face prima acțiune (`instagramProposals` sau `moderationSubmissions`). #ADMIN #NOTIFY #MEDIA
#ADMIN  rg shortcut:          rg -n "#ADMIN" AI_MEMORY.md

---

## WEDDING HUB #WH

#WH  Scop: modul de organizare nuntă pentru miri — invitați, RSVP, plan de mese, invitații digitale
#WH  Trăiește în: src/client/features/wedding-hub/ (client) + src/server/routes/weddingHub.routes.ts (server)
#WH  Admin creează nunți: /admin/wedding-hub → POST /api/wedding-hub/admin/weddings → creează Firebase Auth user + doc Firestore
#WH  Miri se autentifică la: /wedding-hub/login (auth complet separat de /login al fotografului)
#WH  Auth miri: instanță Firebase separată — src/client/features/wedding-hub/firebaseWeddingHub.ts (named app "wedding-hub")
#WH  De ce instanță separată: evită conflictul cu AuthProvider al adminului care setează authorise:true pentru orice user Firebase
#WH  Middleware server: requireCoupleAuth în requireFirebaseAuth.ts — verifică token + caută weddingId după coupleUid
#WH  Colecții Firestore: wh_weddings | wh_guests | wh_tables
#WH  API prefix: /api/wedding-hub/*
#WH  Rute couple (auth): GET /me | PATCH /settings | GET/PATCH /messages/templates | GET /messages/broadcasts | POST /messages/broadcasts | POST /guests | PATCH /guests/:id | POST /guests/bulk-update | DELETE /guests/:id | POST /tables | PATCH /tables/:id | DELETE /tables/:id
#WH  Mock zone separată: /wedding-hub/mock în UI + /api/mock/wedding-hub/* în backend; folosește stare în memorie, gate pe `VITE_WEDDING_HUB_MOCKS=1` / `WEDDING_HUB_MOCKS=1`, pentru simulări RSVP, preview, broadcast queue și istoric per destinatar. #WH
#WH  Rute publice (fără auth): GET /invite/:token | POST /invite/:token/rsvp
#WH  Rute admin (requireSupremeAdmin): POST /admin/weddings | GET /admin/weddings | DELETE /admin/weddings/:id
#WH  Pagini couple: /wedding-hub/dashboard | /wedding-hub/guests | /wedding-hub/seating | /wedding-hub/settings
#WH  Pagina publică invitat: /invite/:token — UI dark rose, complet în română
#WH  Model date invitat: tableId pe guest (nu assignedGuestIds pe table) — tableguestlist derivată pe client cu useMemo
#WH  Meniu copii: câmp separat childrenMenuPreference apare în formularul RSVP când childrenCount > 0
#WH  Token invitație: UUID v4 generat la creare guest, nu conține PII în URL
#WH  State management couple: useReducer+useMemo în WeddingHubContext — acțiuni SET/ADD/UPDATE/REMOVE pentru profile/guests/tables
#WH  Date loading: useWeddingData hook → GET /me returnează profile + guests + tables într-un singur call (Promise.all)
#WH  SSR safe: isBrowser() guard în WeddingHubAuthContext, coupleLoading:true pe server, RequireWeddingAuth arată Loader
#WH  App.tsx routing: WeddingHubAuthWrapper (outer, provide auth) → CheckWeddingAuth/WeddingHubLayout → RequireWeddingAuth → pages
#WH  Evită flash pe refresh: RequireWeddingAuth trebuie să stea înainte de WeddingHubLayout; dacă layout-ul se montează primul, se vede header-ul brut ("Wedding Hub", "Ieși") înainte să se rezolve auth-ul #WH
#WH  Loader Wedding Hub: folosește Loader fullscreen cu label implicit AncaVisuals + subtitle "Wedding Planner" în CheckWeddingAuth/RequireWeddingAuth pentru refresh și auth restore #WH
#WH  Bulk automation: POST /api/wedding-hub/guests/bulk-update actualizează până la 500 invitați într-un singur request (ex: tableId null / asignări în masă / RSVP în masă) și validează ownership-ul pe wedding + mesele referite #WH
#WH  Script local seating: npm run seed:wedding-seating → scripts/seedWeddingSeating.ts; poate crea mese lipsă, reseta seating-ul și repartiza invitații secvențial pentru testare rapidă #WH
#WH  Setări email: `wh_weddings.settings = { emailNotificationsEnabled, notifyOnAccept, notifyOnDecline }`; pagina couple `/wedding-hub/settings` salvează preferințele prin PATCH /api/wedding-hub/settings #WH
#WH  RSVP email notification: la POST /api/wedding-hub/invite/:token/rsvp se trimite email către `coupleEmail` doar dacă email notifications sunt active și bifarea pentru tipul răspunsului (`accept` / `refuz`) este pornită #WH
#WH  RSVP familie: invitația publică acceptă acum `accompanyingAdultNames`, `childrenNames` și `sameTableWithFamily`; copilul / soțul nu sunt așezați automat la aceeași masă, ci doar grupați ca familie în UI și search, iar bifa "Vrem să fim toți împreună la aceeași masă" rămâne doar preferință. #WH
#WH  Mesele au acum și `tableAlias` separat de `tableName`; aliasul poate fi ceva de tip `BFF Mire`, `BFF Mireasa`, `Bunicii`, `Parinti Mire`, `Familie Mireasa` și se poate edita în cardul mesei. #WH
#WH  Tema Wedding Hub: local-only, nu în backend; `WeddingHubThemeProvider` salvează `dark|light` în localStorage key `wedding-hub-theme`, iar `weddingHubTheme.css` face override pentru tema light doar în shell-ul couple-facing #WH
#WH  Admin breadcrumb: "wedding-hub" adăugat în LABELS din Breadcrumb.tsx
#WH  rg shortcut: rg -n "#WH" AI_MEMORY.md

---

## CAPCANE CUNOSCUTE #PITFALL

#PITFALL  Dacă HTML-ul SSR rămâne în cache după deploy, poate referi asset-uri hash-uite vechi; browserul cere JS inexistent, iar fără protecție serverul poate răspunde cu HTML în catch-all (`text/html` în loc de modul JS) #PITFALL
#PITFALL  În development, dacă deschizi UI-ul pe Vite (`127.0.0.1:3000`) fără proxy pentru `/api`, fetch-urile relative primesc `index.html` în loc de JSON. `vite.config.ts` trebuie să proxieze `/api` și `/triggerEvent` către Express (`127.0.0.1:1994`). #PITFALL #QR
#PITFALL  ipinfo.ts ← nu ipInfo.ts  (case sensitivity macOS vs Linux CI)
#PITFALL  QRMoment.routes.ts ← nu qrMoment.routes.ts
#PITFALL  Onboardingwizard.tsx ← nu OnboardingWizard.tsx
#PITFALL  tsconfig: forceConsistentCasingInFileNames: true → pică în CI
#PITFALL  vitest: nu acceptă flag-uri Jest-style (ex: --runInBand)
#PITFALL  SSR: renderToString sincron → nu folosi fetch async pentru date SSR
#PITFALL  blog: articol fără intrare în blogManifest.ts → SSR fără meta tags
#PITFALL  worktree: nu reseta schimbări care nu sunt ale tale fără git status
#PITFALL  Firestore Timestamps: când se citesc din Firestore în backend și se pasează la Puppeteer PDF, apar ca obiecte {_seconds, _nanoseconds}. `new Date(timestamp)` → "Invalid Date", String(timestamp) → "[object Object]". Fix: helper toIsoString() în pdf.generator.ts care detectează _seconds și convertește. #PITFALL #ADMIN
#PITFALL  Nu genera colecții de `<Route>` din funcții apelate direct în render-ul lui `App` pentru zone lazy/protejate (`adminRoutes()`, `weddingHubRoutes()`). Dacă `App` rerandează dintr-un provider/context, React Router poate remonta pagina activă și reaprinde loader-ele. Ține rutele ca constante/module-level exports. #PITFALL #ADMIN #WH
#PITFALL  `npm run dev` nu trebuie să pornească și `vite --config vite.config.ts` separat cât timp `server.ts` creează deja propriul Vite în `middlewareMode`; altfel HMR/WebSocket intră în conflict (`WebSocket server error: Port is already in use`) și UI-ul poate părea că se restartează. Folosește `npm run dev` pentru SSR app pe `:1994`, iar `npm run dev:dual` doar dacă chiar vrei ambele instanțe. #PITFALL #DEBUG

---

## DEBUGGING RAPID #DEBUG

#DEBUG  Cannot find module  → rg --files src | rg '<modul>'  apoi verifică casing
#DEBUG  Trece local, pică CI → suspectează casing / fișier necomis / versiune Node
#DEBUG  Problemă doar în build → importuri ESM, extensii, path-uri generate
#DEBUG  Verificare completă: npm run typecheck && npm test

---

## RECENT CHANGES #RECENT
#RECENT  2026-05-25: Zona Trading din admin a fost eliminată complet (`/admin/trading`, meniuri, breadcrumb, fișierele din `src/client/features/admin/components/Trading/`), iar `npm run typecheck` + `npm run build` trec din nou. #RECENT #ADMIN #PITFALL
#RECENT  2026-05-25: Admin > Conturi poate trimite invitații per album către colaboratori existenți, cu email inițial + reminder-e automate la 24h, +72h, +7 zile, +14 zile și +30 zile. Reminder-ele sunt per `albumSlug`, se opresc după prima propunere Instagram/Media Assets sau prima propunere de ștergere, iar cronul nou rulează din `src/server/cron/collaboratorInviteReminder.cron.ts`. #RECENT #ADMIN #NOTIFY #MEDIA
#RECENT  2026-05-13: Zona Financiar are acum tab nou `Extrase cont`: poți încărca un extras bancar PDF/imagine, AI extrage toate entry-urile și încearcă să le justifice automat prin facturile și cheltuielile existente din anul selectat. Implementare: `src/server/routes/bankStatements.routes.ts` + integrare în `src/client/features/admin/components/Financial/FinancialPage.tsx`. Validat cu `npm run typecheck`. #RECENT #ADMIN
#RECENT  2026-05-13: Dev setup fix — `npm run dev` pornește acum doar `dev:server`, deoarece `server.ts` include deja Vite în `middlewareMode`; rularea paralelă cu `dev:client` crea conflict HMR/WebSocket (`Port is already in use`) și putea face UI-ul din `/admin` să pară că se restartează. Script nou `dev:dual` păstrează varianta cu ambele procese doar pentru debugging explicit. #RECENT #DEBUG #PITFALL
#RECENT  2026-05-13: Fix pentru `/admin` care repornea vizual loader-ul în buclă: rutele lazy/protejate pentru admin și Wedding Hub nu mai sunt generate din funcții apelate în render-ul lui `App`, ci exportate ca constante module-level (`adminRoutes`, `weddingHubRoutes`), astfel încât rerender-urile globale să nu mai remonteze dashboard-ul și `AncaLoader`. Validat cu `npm run typecheck`. #RECENT #ADMIN #WH #PITFALL
#RECENT  2026-05-02: RSVP-ul public Wedding Hub permite acum un mesaj liber la confirmare, plus sugestii de text și emoji-uri rapide; mesajul este salvat pe guest și inclus în emailul de notificare către miri. Validat cu `npm run typecheck` și `npm run build`. #RECENT #WH
#RECENT  2026-05-02: Parser-ul pentru importul AI din poză a fost făcut tolerant la JSON imperfect: răspunsul Claude este extras din blocurile markdown/code fence și reparat cu `jsonrepair` înainte de `JSON.parse`, ca să nu mai pice la virgule/lipsă de bracket. Validat cu `npm run typecheck` și `npm run build`. #RECENT #WH
#RECENT  2026-05-02: Importul AI din poză pentru Wedding Hub acceptă acum și HEIC/HEIF direct din iPhone: backend-ul normalizează `image/jpg`, încearcă conversia HEIC prin `heic-convert` și are fallback la `sharp` înainte de apelul către Claude. Validat cu `npm run typecheck` și `npm run build`. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub a primit import AI din poză pentru invitați: `POST /api/wedding-hub/guests/extract-from-image` folosește Claude pentru a extrage nume/telefon/email/notes din screenshot-uri, iar `AddGuestModal` are secțiune `Import din poză` cu preview editabil și `POST /api/wedding-hub/guests/bulk-create` pentru import în bulk cu deduplicare. Validat cu `npm run typecheck` și `npm run build`. #RECENT #WH
#RECENT  2026-05-02: Reminder-ul post-eveniment pentru backup media a fost extins: emailul ajunge la ~24h după evenimentul `finalizat`, apoi se repetă la fiecare 48h până când confirmi backup-ul din linkul din email. Confirmarea setează `postEventBackupConfirmedAt` în `adminEvents`, iar subiectul include data de trimis + numărul reminder-ului ca să nu se grupeze în același thread. Validat cu `npm run typecheck` și `npm run build`. #RECENT #ADMIN #NOTIFY #MEDIA
#RECENT  2026-05-02: Adăugat reminder post-eveniment pentru backup media: cron nou `src/server/cron/postEventBackupReminder.cron.ts` trimite un email la `adminUser.email` la ~24h după un eveniment `finalizat`, folosind flag-ul Firestore `postEventBackupReminderSentAt` ca anti-duplicat și link direct către albumul media dacă există `albumSlug`. Validat cu `npm run typecheck` și `npm run build`. #RECENT #ADMIN #NOTIFY #MEDIA
#RECENT  2026-05-02: RSVP-ul Wedding Hub poate acum să captureze familie/plus-one separat: invitația publică permite nume pentru adulții și copiii care vin, plus bifa "Vrem să fim toți împreună la aceeași masă" ca preferință, fără auto-seating; listarea invitaților și planul de mese caută și afișează membrii familiei ca grup. Validat cu `npm run typecheck` și `npm run build`. #RECENT #WH
#RECENT  2026-05-02: Mesele Wedding Hub au primit `tableAlias` separat de `tableName`; aliasul e editabil din cardul mesei și poate fi folosit pentru etichete de tip `BFF Mire`, `Bunicii` sau `Familie Mireasa`, fără să pierzi denumirea oficială a mesei. #RECENT #WH
#RECENT  2026-05-02: Adăugată zona separată de mock pentru Wedding Hub: sidebar-ul are acum `Mock`, pagina `/wedding-hub/mock` simulează RSVP + mesaje bulk + preview dry-run + coadă în memorie, iar backend-ul expune `/api/mock/wedding-hub/*` fără să atingă Firestore. Zona e gate-uită explicit de `VITE_WEDDING_HUB_MOCKS=1` și `WEDDING_HUB_MOCKS=1`. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub guests page ajustată incremental pentru UX, fără redesign complet: filtrele și căutarea au rămas în stilul inițial, dar cu target-uri tactice mai bune, stats discrete, empty state mai clar și CTA sticky pe mobil; modalele Add/Edit păstrează look-ul anterior cu mici ajustări de spacing și responsive behavior. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub Mesaje a trecut pe broadcast async cu istoric și șabloane: API-ul are acum GET/PATCH /messages/templates, GET /messages/broadcasts și POST /messages/broadcasts, broadcast-urile se salvează în Firestore cu status queue/processing/sent/partial/failed, iar UI-ul are tab-uri pentru trimitere, șabloane editabile și istoric. Filtrele suportă confirmați, fără/cu masă și tipuri de contact, cu fallback explicit între email și SMS. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub are acum pagina `Mesaje` și endpoint-ul `POST /api/wedding-hub/messages/broadcasts` pentru trimitere bulk către invitații confirmați; mesajul merge pe email și, dacă există telefon valid + SMS configurat, și pe telefon, iar dacă un invitat are ambele contacte primește pe ambele canale. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub settings extinse pentru email RSVP: toggle master + toggle separat pentru acceptări și refuzuri; cuplul poate primi email doar la confirmări, doar la refuzuri sau la ambele. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub are acum dark/light mode pentru zona couple-facing; tema se schimbă din Setări și persistă local în browser, fără modificări în backend. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub automation pentru teste: endpoint nou POST /api/wedding-hub/guests/bulk-update pentru update-uri în masă pe invitați (inclusiv mutări între mese / scoatere din mese) și script nou npm run seed:wedding-seating care poate crea mese lipsă, reseta seating-ul și face asignare secvențială automată. #RECENT #WH
#RECENT  2026-05-02: Fix pentru flash la refresh pe Wedding Hub: în App.tsx, RequireWeddingAuth a fost mutat înainte de WeddingHubLayout ca să nu se mai monteze shell-ul înainte de auth restore; Loader fullscreen suportă acum subtitle și Wedding Hub afișează "Wedding Planner" sub AncaVisuals în stările de încărcare. #RECENT #WH
#RECENT  2026-05-02: Wedding Hub MVP implementat complet — modul dedicat pentru miri, complet separat de /admin. Fișiere noi: src/client/features/wedding-hub/ (16 fișiere: types, auth context, data context, hooks, layout, guards, 5 pagini, 3 componente), src/server/routes/weddingHub.routes.ts, src/client/features/admin/components/WeddingHub/WeddingHubAdminPage.tsx. Modificate: server.ts (înregistrare router), App.tsx (rute + HIDE_CHAT_PREFIXES), requireFirebaseAuth.ts (adăugat requireCoupleAuth + CoupleAuthenticatedRequest), Breadcrumb.tsx (label wedding-hub). Auth couple pe instanță Firebase separată (named app "wedding-hub") pentru izolare față de admin. Colecții Firestore: wh_weddings, wh_guests, wh_tables. Zero erori TypeScript. #RECENT #WH
#RECENT  2026-05-01: Media albums expun acum `retention` derivat din `adminEvents.eventDate + 60 zile` direct în `GET /api/album/:slug`; `MediaConsentModal` afișează countdown live până la expirare, iar cronul nou `src/server/cron/albumRetention.cron.ts` trimite reminder abonaților la 7 zile și 1 zi înainte plus email admin la expirare (album de șters / mutat offline). Starea reminderelor trimise se salvează în `printSelections.retentionNotifications`. Validat cu `npm test` și `npm run build`. #RECENT #MEDIA #NOTIFY #ADMIN
#RECENT  2026-05-01: Dashboard admin — `GoalCard` și `FinancialSummary` sunt acum colapsabile din săgeata din dreapta sus și pornesc compactate pentru a reduce înălțimea secțiunii de obiective și situație financiară. Validat cu `npm test` și `npm run build`. #RECENT #ADMIN
#RECENT  2026-05-01: QR Moments public page afișează acum jos un card promo AncaVisuals pentru viitori miri: mesaj despre QR Moments + servicii (foto, video, fotocabină, video booth 360) + referral cu ședință foto, plus carousel auto/swipe alimentat din `GET /api/admin/landing/gallery` (imagini landing publice existente). Validat cu `npm run typecheck` și `npm run build`. #RECENT #QR #ADMIN
#RECENT  2026-05-01: AddLeadModal poate acum încărca un screenshot/imagine și cere lui Claude să extragă conservator telefonul, numele, data și un tip de eveniment doar dacă este clar; nou endpoint protejat `POST /api/admin/leads/extract-from-image` cu `Authorization: Bearer`, iar UI-ul precompletează doar câmpurile găsite. Validat cu `npm run typecheck` și `npm run build`. #RECENT #ADMIN
#RECENT  2026-05-01: QR Moments upload page afișează acum waveform live în timpul înregistrării vocale, folosind Web Audio API (`AudioContext` + `AnalyserNode`) și `canvas`, cu cleanup explicit pentru stream/context la stop, reset și unmount. Validat cu `npm run typecheck`, `npx vitest run tests/vitest/client/pages/QRMoments/QRMomentsPage.test.tsx` și `npm run build`. #RECENT #QR #PITFALL
#RECENT  2026-04-29: Dev fix pentru QR/admin API calls — `vite.config.ts` proxiează acum `/api` și `/triggerEvent` către Express (`127.0.0.1:1994`), ca paginile deschise pe Vite (`:3000`) să nu mai primească `index.html` la fetch-uri. `QRMomentsAdminPage` detectează și răspunsurile HTML și afișează un mesaj clar de configurare în loc de dump-ul complet din pagina SSR. #RECENT #QR #DEBUG #PITFALL
#RECENT  2026-04-29: Admin QR Moments creează acum evenimente doar din `adminEvents` confirmate, viitoare, afișate în lista din modal ca primele 6 cele mai apropiate. Numele QR Moment-ului se generează automat din data nunții (`21martie2026` etc.), iar modalul are `notificationEmail` opțional: când un invitat încarcă fișiere, se trimite email de notificare către acea adresă. Validat cu `npm run typecheck` și `npm run build`. #RECENT #QR #ADMIN
#RECENT  2026-04-29: QR Moments are debugging explicit pentru eșecuri client-side la register/upload: pagina capturează buffer de `console.error`/`console.warn` și îl trimite în monitoring cu prefix `[QR DEBUG]`; backend-ul salvează eroarea și trimite email imediat către admin cu pagina, IP/geo și contextul JSON al sesiunii. Validat cu `npm run typecheck` și `npm run build`. #RECENT #QR #DEBUG #NOTIFY
#RECENT  2026-04-29: QR Moments hardening/integration — rutele publice `/qr-moments/:eventSlug`, `/qr-moments/:eventSlug/gallery` și `/qr-moments/unsubscribe/:guestId` sunt acum legate cap-coadă; `pass` este cerut server-side și la register/upload, comentariile sunt protejate cu PIN+eventSlug, iar testele client pentru upload/gallery/unsubscribe trec (`npm run typecheck` + `npx vitest run tests/vitest/client/pages/QRMoments/QRMomentsPage.test.tsx`). #RECENT #QR #PITFALL
#RECENT  2026-04-22: Mementos admin — modalul "Memento nou" nu se mai închide la click pe overlay, iar formularul păstrează draft-ul în `localStorage` (`admin:mementos:add-draft`) până la salvare reușită; redeschiderea modalului reîncarcă automat draftul. Validat cu `npm run typecheck`. #RECENT #ADMIN
#RECENT  2026-04-22: FinancialSummary din dashboard a fost aliniat semantic cu cashflow-ul real: progresul este galben, sumarul folosește "Bani primiți" în loc de "Avans încasat", iar detaliul pe evenimente separă sumele deja primite de cele rămase de încasat, pe modelul paginii Goal detail. Validat cu `npm run typecheck`. #RECENT #ADMIN
#RECENT  2026-04-22: Dashboard admin / EventList afișează acum în tab-ul "Viitoare" 3 blocuri pe ani: anul curent rămâne mereu deschis, iar următorii 2 ani (în prezent 2027 și 2028) apar ca secțiuni colapsabile pentru evidența clienților rezervați în avans. Validat cu `npm run typecheck` și Vitest pe helper-ele `partitionEvents` / `groupByMonth`. #RECENT #ADMIN
#RECENT  2026-04-22: Admin are pagină dedicată `/admin/bank-details` pentru detalii bancare. Salvează `beneficiaryName` și `iban` în `settings/admin.bankDetails`, iar contractele folosesc aceste valori la randare: preview PDF, PDF final și pagina publică de semnare afișează beneficiarul + IBAN-ul doar pentru `Transfer bancar`. Validat cu `npm run typecheck`. #RECENT #ADMIN
#RECENT  2026-04-22: Admin events au primit flag-ul `fiscalized` în Firestore/UI. Default-ul este `false` (nefiscalizat), EventCard afișează marker + toggle rapid, AddLeadModal permite setarea la creare, iar EventList are filtru `Toate | Fiscalizate | Nefiscalizate`. Validat cu `npm run typecheck` după actualizarea mock-urilor Vitest pentru `ClientEvent`. #RECENT #ADMIN
#RECENT  2026-04-16: Contract feature extins — editare contract înainte de semnare (EditContractPage la /admin/contracts/:id/edit, amber accent); PATCH /api/contracts/:id blocat dacă status=signed; linking bidirecțional contract↔eveniment via contractId/eventId; CreateContractPage pre-populat din EventCard via location.state; contract fizic (attachmentUrls) = echivalent cu contract digital (C✓, ascunde "Creează contract"). #RECENT #ADMIN
#RECENT  2026-04-16: Fix Firestore Timestamps în PDF generator — Timestamp objects ({_seconds, _nanoseconds}) erau coerced la "[object Object]" în template literals. Adăugat helper toIsoString() în pdf.generator.ts care detectează shape-ul Timestamp și convertește via _seconds*1000. Fix aplicat pe signedDate, contractDate, footer timestamp. #RECENT #ADMIN #PITFALL
#RECENT  2026-04-16: AddLeadModal — câmpuri noi total/avans/rest cu calcul automat și checkbox "avans deja încasat"; fix bug unde avansul apărea ca 0 EUR (backend ignorase pricing din body, onAdded hardcodase zerouri). POST /api/admin/events citește acum pricing direct din body. #RECENT #ADMIN
#RECENT  2026-04-16: FinancialSummary — componentă nouă în Dashboard: filtrează evenimentele confirmat+finalizat din anul curent, arată progres avans încasat vs total contractat, detaliu colapsibil pe evenimente viitoare cu cât urmează să fie primit. #RECENT #ADMIN
#RECENT  2026-04-16: MultiFileDropZone — componentă nouă pentru upload multiple fișiere (contract fizic/poze); progress per fișier, thumbnails pentru imagini, delete individual din Firebase Storage. Folosită în EventCard edit modal. #RECENT #ADMIN
#RECENT  2026-04-16: GoalCard rewrite — editabil EUR target și date range; doar goal-ul de 6 luni are editableRange (date picker); titlu redenumit "Goal Personalizat"; settings salvate în Firestore settings/admin cu exchangeRate. EventList default tab schimbat la "Viitoare". #RECENT #ADMIN
#RECENT  2026-04-16: Zile ocupate unificate — singura sursă de adevăr e acum `adminEvents` (confirmat+finalizat). `GET /api/booked-dates` (public, nou) + `GET /api/admin/booked-dates` citesc ambele din Firestore. BookingWizard și chatbot nu mai citesc din `bookedDates.json` Storage. Fișierul JSON e acum defunct. #RECENT #ADMIN #PITFALL
#RECENT  2026-04-15: Lead management adăugat în admin dashboard. `ClientEvent.eventDate` e acum `Date | null` (lead-urile pot fi create fără dată). Nou component `AddLeadModal.tsx`. `EventList.tsx` are 4 taburi: Lead-uri / Viitoare / Trecute / Arhivă. `EventCard.tsx` arată butoane rapide [Tentativ] [Confirmă] [Renunță] pentru status lead/tentativ. Backend `POST /api/admin/events` nu mai cere `eventDate`. `GoalCard.tsx` are guard pentru eventDate null. #RECENT #ADMIN
#RECENT  2026-04-15: Contract feature complet: creare contract (admin), semnare client via link public (`/contract/:token`), generare PDF Puppeteer, upload Firebase Storage, email cu link PDF. Rute noi: DELETE /:id, GET /:id/preview, POST /:id/cancel, POST /:id/prestator-sign, POST /:id/send. Email trimis la ștergere contract (`sendContractDeletedEmail`). #RECENT #ADMIN #NOTIFY
#RECENT  2026-04-11: `public/sitemap.xml` a fost actualizat pentru rutele publice reale: a fost scos `/orase` din indexare, au fost adăugate `/bio`, `/blog` și toate slug-urile de blog, păstrând doar rutele SEO canonice de tip `/foto-video-{serviciu}-{oras}`. Paginile legale (`/privacy`, `/terms`, `/copyright`) au fost scoase ulterior din sitemap. Validat ca XML parseabil; total 178 URL-uri. #RECENT #LOCATION #BLOG #PITFALL
#RECENT  2026-04-11: Testele au fost reorganizate sub `tests/` și artefactele generate sub `reports/`. Vitest rulează acum din `tests/vitest`, Playwright din `tests/e2e`, coverage merge în `reports/coverage`, iar Playwright HTML/report attachments merg în `reports/playwright` și `reports/test-results`. `npm test` și `npm run typecheck` au trecut după mutare. #RECENT #CMD #DEBUG #PITFALL
#RECENT  2026-04-11: Setup Playwright E2E minimal adăugat: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, scripturi `npm run test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `test:e2e:report`. `server.ts` dezactivează HMR când `PLAYWRIGHT=1` pentru a evita portul websocket suplimentar în rulările E2E. Smoke suite-ul rulează și detectează în prezent că `/contact` și `/portofoliu` nu se hidratează la conținutul așteptat în 15s, în timp ce homepage trece. #RECENT #CMD #DEBUG #SSR #PITFALL
#RECENT  2026-04-11: Fix defensiv pentru asset-uri lipsă după deploy/cache stale. `server.ts` nu mai trimite HTML pentru requesturi de asset ratate (returnează 404 text/plain) și setează `Cache-Control: no-store, max-age=0` pe răspunsurile SSR HTML, ca să nu rămână în cache un `index.html` care referă hash-uri vechi. Validat cu `npm run typecheck` și `npm run build`. #RECENT #PITFALL #SSR
#RECENT  2026-04-11: Stilizarea articolelor de blog nu mai depinde de `prose` din Tailwind. `tailwind.config.cjs` nu are pluginul Typography activ, deci `prose` nu producea layout editorial real. Soluție: `src/client/pages/Blog/BlogPost.tsx` folosește acum clasa globală `blog-article`, definită în `src/client/index.css`, cu spacing, heading-uri, liste, blockquote, code și linkuri stilizate explicit. Validat cu `npm run typecheck` și `npm run build`. #RECENT #BLOG #PITFALL #THEME
#RECENT  2026-04-11: Fix blog API 404 în build/prod. Cauza: blogUtils alegea `dist/data` doar pentru că exista, dar markdown-urile copiate erau în `dist/*.md`. Soluție: `src/server/utils/blogUtils.ts` rezolvă acum directorul de blog doar dintre candidații care conțin efectiv fișiere `.md`. Validat după build: `getPostBySlug('acte-botez-turda')` găsește postul și `getAllPosts()` returnează 60. #RECENT #BLOG #PITFALL

#RECENT  2026-04-11  Adăugat AGENTS.md ca entrypoint scurt pentru agenți; AI_MEMORY.md rămâne sursa principală de context
#RECENT  2026-04-11  Regula nouă pentru push/PR: validare explicită cu typecheck + test + build, și lint când este relevant
#RECENT  2026-04-11  Restructurat AI_MEMORY.md cu tag-uri rg-friendly (#TAG pe fiecare linie)
#RECENT  2026-04-11  Blog SEO: 60 articole Markdown + API /api/blog + pagini /blog și /blog/:slug
#RECENT  2026-04-11  data/blogManifest.ts: index static pentru SSR meta tags
#RECENT  2026-04-11  src/client/utils/theme.ts: constanta ACCENT (amber-200)
#RECENT  2026-04-11  Contact /contact: hero scurtat, BookingWizard mutat direct după hero
#RECENT  2026-04-11  Bugfix importuri: ipinfo.ts, QRMoment.routes, Onboardingwizard
#RECENT  2026-04-11  GitHub Actions actualizat la checkout@v4 + setup-node@v4
#RECENT  2026-04-11  Upgrade Node standard la 22 în `.nvmrc` și `.github/workflows/nodejs.yml` pentru compatibilitate cu Firebase packages
#RECENT  2026-04-11  Workflow CI împărțit în joburi separate: lint, typecheck, test, build
