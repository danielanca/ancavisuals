# Changelog & Feature Reference

Fiecare secțiune documentează ce s-a construit, fișierele implicate și cum funcționează.

---

## [branch: updates-24may26] — Mai 2026

---

### 🖼️ Media Album UX + invitații colaborator

**Ce face:** Pagina `/media/:slug` a primit update-uri consistente pentru album browsing, promo footer și fluxul de invitații către colaboratori.

**Cum funcționează:**
1. Galeria principală din album folosește acum masonry real și pe mobil, cu minimum 4 coloane pe desktop și toggle de 1/2 coloane disponibil și pe tabletă/desktop
2. Fiecare poză din galerie are overlay de hover cu eye hint și buton de download în dreapta-jos, mai mare, pătrat și ușor rotunjit
3. Lightbox-ul închide poza la click în afara imaginii, dar nu la click direct pe imagine; imaginea este constrânsă să încapă complet în viewport
4. Footerul promo din `/media` păstrează banda foto doar pe desktop, iar galeria promo de dedesubt este masonry clickabilă cu lightbox separat
5. Chatbotul apare pe `/media` doar când intri în zona promo/reclamă de la finalul paginii
6. Panoul „Invită colaborator” există direct în album, collapsed by default, trimite email instant și pornește reminder-e per album la 24h, 72h, 7 zile, 14 zile și 30 zile; lanțul se oprește după prima propunere Instagram/Media Assets sau prima propunere de ștergere

**Fișiere:**
- `src/client/pages/MediaDownload/MediaAlbumPage.tsx`
- `src/client/pages/MediaDownload/MediaAlbumPage.module.scss`
- `src/client/pages/MediaDownload/PhotoLightbox.tsx`
- `src/client/pages/MediaDownload/PhotoLightbox.module.scss`
- `src/client/pages/Portfolio/BunnyPhotoGallery.tsx`
- `src/client/pages/Portfolio/BunnyPhotoGallery.module.scss`
- `src/client/App.tsx`
- `src/client/features/admin/components/AccountsPage.tsx`
- `src/server/routes/accounts.routes.ts`
- `src/server/routes/instagramProposals.routes.ts`
- `src/server/routes/moderation.routes.ts`
- `src/server/services/collaboratorInvite.service.ts`
- `src/server/notifications/templates/collaboratorInviteTemplate.ts`
- `src/server/cron/collaboratorInviteReminder.cron.ts`
- `server.ts`

**Notă validare:** `npm run typecheck` rămâne blocat de erori preexistente în `src/client/features/admin/components/Trading/*`, nelegate de acest feature set.

---

### 🔔 Admin Bell — abonați per album cu ștergere

**Ce face:** AdminBar-ul arată câți abonați are albumul curent, cu posibilitate de a vedea emailurile și a șterge abonați individual.

**Cum funcționează:**
1. Pe orice pagină `/media/:slug`, butonul 🔔 din AdminBar afișează un badge cu numărul de abonați (galben dacă >0, gri „0" dacă niciun abonat — ca să știi că nu are rost să apeși Notifică)
2. Click pe 🔔 deschide un dropdown cu lista emailurilor + buton „Notifică" (dezactivat când sunt 0 abonați)
3. La fiecare deschidere a dropdown-ului se re-fetch-uiesc abonații (ca să apară cei noi fără refresh pagină)
4. Fiecare email are un buton **✕** — click șterge abonatul din Firestore și îl elimină instant din listă
5. Badge-ul dispare din lista de jos a albumului (acum e centralizat în AdminBar)

**Endpoint-uri noi:**
- `GET /api/album-subscriptions/list/:slug` — fără `orderBy` (nu mai necesită index composite Firestore)
- `DELETE /api/album-subscriptions/unsubscribe` — șterge `{ albumSlug, email }`, doar admin

**Fișiere:**
- `src/client/components/UI/AdminBar.tsx` — fetch subscribers on mount + re-fetch on open, badge, dropdown cu ✕
- `src/server/routes/albumSubscriptions.routes.ts` — endpoint DELETE /unsubscribe, eliminat orderBy din list

---

### 🧭 Tutorial OnboardingWizard — refăcut complet

**Ce face:** Tutorial pas-cu-pas pentru clienți la prima vizită pe albumul lor, cu 6 pași, highlight vizual și tooltip pozitionat inteligent.

**Cum funcționează:**
1. La prima vizită (după acceptarea consimțământului), tutorialul pornește automat
2. Butonul „? CUM FUNCȚIONEAZĂ?" îl repornește oricând (lângă „Completează adresa de livrare")
3. 6 pași: apasă poză, navigare pagini, abonare notificări, descărcare ZIP, selectare imprimare, zona de imprimare
4. Scroll blocat pe durata tutorialului (event listeners pe `wheel`/`touchmove`/`keydown`)
5. Tooltip se poziționează automat față de element, cu fallback la centrul viewport când elementul e prea mare
6. Pe mobil, tooltip-ul apare ca sheet din josul ecranului

**Bug fix critic:** Butonul „Următor" nu funcționa — cauza: `onClose` inline (recreat la fiecare render) forța re-run-ul effect-ului, resetând wizard-ul la pasul 0. Fix: `useRef` pentru callbacks.

**Fișiere:**
- `src/client/pages/MediaDownload/Onboardingwizard.tsx` — refs pentru callbacks, scroll lock cu event listeners, 6 STEPS noi
- `src/client/pages/MediaDownload/OnboardingWizard.module.scss` — buton skip roșu, `strong { color: #facc15 }`

---

### 🖼️ Showcase Zone Editor — layout masonry

**Ce face:** Editorul de zone showcase (`/admin/showcase`) afișează „Selecția curentă" în masonry de sus în jos, cu preview Desktop/Mobile.

**Cum funcționează:**
- Lista foto: `columns: 2`, fără maxHeight — se extinde liber în jos, badge `#N` pe fiecare poză
- Preview Desktop: `columns: 4`, max 12 poze, `maxHeight: 200px`
- Preview Mobile: `columns: 2`, `maxWidth: 180px`, max 6 poze

**Fișiere:**
- `src/client/features/admin/components/ShowcaseZoneEditorPage.tsx`

---

### 🧪 Teste — acoperire pentru funcționalitățile noi

**Ce testează:**
- `OnboardingWizard.test.tsx` — 13 teste: navigare pași, regresie stale closure, skip elemente absente, Gata!/Înapoi, ambele butoane skip
- `AdminBar.test.tsx` — 14 teste: badge 0/N, dropdown, emailuri ca mailto, Notifică dezactivat, re-fetch la deschidere, ✕ șterge abonat
- `albumSubscriptions.routes.test.ts` — 17 teste: subscribe (nou/duplicat/normalize/câmpuri lipsă), list, count, unsubscribe (găsit/404/400), notify

**Total: 383 teste, toate passed. Typecheck și lint clean.**

---

### 🐛 Client Debug Notification — badge erori cu WhatsApp

**Ce face:** Când apare o eroare JS în browser, apare automat un badge roșu pe dreapta ecranului. Clienții pot trimite direct pe WhatsApp un screenshot cu eroarea. Adminii văd detaliile tehnice complete.

**Cum funcționează:**
1. `ErrorMonitorContext` capturează mereu erorile reale (`window.error` + `unhandledrejection`), indiferent dacă debug mode e activ
2. Patch-ul pe `console.error` și `fetch` rămâne doar când debugging e activat manual
3. Badge-ul roșu apare fix pe dreapta ecranului, pulsează când apare o eroare nouă, arată numărul de erori
4. Click pe badge → panel slide-in din dreapta:
   - **Clienți (non-admin):** mesaj friendly + buton verde „Trimite pe WhatsApp" (deschide direct `wa.me/40745469907`)
   - **Admini:** lista tehnică completă cu tip eroare, mesaj, stack trace, timestamp

**Fișiere:**
- `src/client/features/admin/providers/ErrorMonitorContext.tsx` — split useEffect: always-on + debugging-only
- `src/client/features/admin/components/ClientDebugBadge.tsx` — componentă nouă (badge + panel)
- `src/client/App.tsx` — `<ClientDebugBadge />` adăugat în `AuthProvider`

---

## [branch: accountable] — Mai 2026

---

### 🔔 Abonare notificări album

**Ce face:** Vizitatorii albumului se pot abona cu emailul să primească notificare când fotograful adaugă poze/video noi.

**Cum funcționează:**
1. Pe `/media/:slug` apare o bară cu input email + buton „Abonează-te"
2. Datele se salvează în colecția Firestore `albumSubscriptions` `{ albumSlug, email, subscribedAt }`
3. Dacă emailul e deja abonat → răspuns `{ alreadySubscribed: true }`, fără duplicat
4. Ca admin, din bara de sus (AdminBar), pe orice pagină `/media/:slug` apare butonul **„🔔 Notifică abonații"**
5. Click pe buton → `POST /api/album-subscriptions/notify/:slug` → email trimis la toți abonații albumului

**Endpoint-uri server:**
- `POST /api/album-subscriptions/subscribe` — publică, fără auth
- `POST /api/album-subscriptions/notify/:slug` — doar admin (requireSupremeAdmin)
- `GET /api/album-subscriptions/count/:slug` — număr abonați, doar admin

**Fișiere:**
- `src/server/routes/albumSubscriptions.routes.ts`
- `src/client/pages/MediaDownload/MediaAlbumPage.tsx` — state `subscribeEmail`, `subscribeStatus`, funcție `handleSubscribe`, UI bara de abonare
- `src/client/components/UI/AdminBar.tsx` — buton notificare, detectare slug din `location.pathname`

---

### 📸 Propuneri Instagram — pagină admin dedicată

**Ce face:** Centralizează toate propunerile de poze pentru Instagram din toate albumele, cu două view-uri: grid și pipeline.

**Cum funcționează:**
- Clienții/adminul propun poze din pagina albumului (`/media/:slug`) → salvate în Firestore `instagramProposals`
- Pagina admin `/admin/instagram-proposals` fetchează toate propunerile via `GET /api/instagram-proposals/admin/all`
- **Tab „Toate"** — grid filtrat pe status (Pending / Postat / Respins / Toate) + filtru pe album
- **Tab „Pipeline"** — doar propunerile „pending", grupate pe albume
  - Header per album: nume album (link), badge „N în pipeline", buton „↓ Descarcă toate"
  - Albumele se colapsează/expandează cu click
  - Fiecare poză: buton „↓ Descarcă", Postat, Respins, Șterge
- Download: `fetch` → `createObjectURL` → browser download; fallback `window.open`

**Endpoint-uri server:**
- `GET /api/instagram-proposals/admin/all` — toate propunerile, desc după dată (requireSupremeAdmin)
- `GET /api/instagram-proposals/album/:slug` — propuneri per album (orice user auth)
- `POST /api/instagram-proposals` — propune o poză (orice user auth)
- `PATCH /api/instagram-proposals/:id` — actualizează status (requireSupremeAdmin)
- `DELETE /api/instagram-proposals/:id` — șterge (requireSupremeAdmin)

**Important:** Ruta `GET /admin/all` trebuie să fie definită **înaintea** `GET /album/:slug` în router, altfel Express ar putea face match greșit.

**Fișiere:**
- `src/client/features/admin/components/InstagramProposalsAdminPage.tsx`
- `src/client/App.tsx` — rută `/admin/instagram-proposals`
- `src/client/features/admin/components/Dashboard/index.tsx` — nav item „Propuneri Instagram"
- `src/client/features/admin/components/Breadcrumb.tsx` — label `instagram-proposals`
- `src/server/routes/instagramProposals.routes.ts` — endpoint `GET /admin/all`

---

### 🔑 AdminBar — disponibil pe tot site-ul

**Ce face:** Bara de admin apare pe **orice pagină** când ești logat, nu doar în zona `/admin`.

**Comportament:**
- Logat admin + pe pagină publică → bară neagră sus cu: „Admin: nume", „Dashboard →", „Deloghează-te"
- Logat admin + pe `/media/:slug` → apare și butonul „🔔 Notifică abonații"
- Pe exact `/admin` → butonul „Dashboard →" dispare (ești deja acolo)
- Nelogat → bara nu apare deloc

**Fișier:** `src/client/components/UI/AdminBar.tsx`

---

### 🗑️ Dashboard — eliminat butonul duplicat „Deconectare"

Exista: „Deloghează-te" în AdminBar + „Deconectare" în Dashboard. S-a păstrat doar cel din AdminBar (mereu vizibil pe orice pagină).

**Fișier:** `src/client/features/admin/components/Dashboard/index.tsx`

---

## [branch: accountable] — Aprilie 2026

---

### 📱 QR Moments — sistem complet upload invitați

**Ce face:** Invitații scanează un QR code la eveniment și ajung pe o pagină mobilă unde pot încărca poze, video și mesaje vocale.

**Flow complet:**
1. Admin creează QR Moment din `/admin/qr-moments` → selectează eveniment confirmat/viitor, se generează automat un slug (ex. `21martie2026`), opțional email de notificare
2. QR code-ul trimite invitatul la `/qr-moments/:eventSlug`
3. Invitatul se înregistrează cu nume + email + `pass` (parola evenimentului)
4. Poate încărca poze/video/audio
5. Admin vede fișierele în `/admin/qr-moments`

**Rute publice:**
- `/qr-moments/:eventSlug` — pagina de upload
- `/qr-moments/:eventSlug/gallery` — galerie poze încărcate
- `/qr-moments/unsubscribe/:guestId` — dezabonare email

**Endpoint-uri server:** `src/server/routes/qrMoments.routes.ts`

**Debugging:** Eșecurile de upload sunt raportate la `/api/monitoring/client-error` cu prefix `[QR DEBUG]`, backend trimite email imediat.

**Fișiere:**
- `src/server/routes/qrMoments.routes.ts`
- `src/client/pages/QRMoments/QRMomentsPage.tsx`
- `src/client/pages/QRMoments/QRMomentsGalleryPage.tsx`
- `src/client/pages/QRMoments/QRMomentsUnsubscribePage.tsx`
- `src/client/features/admin/components/QRMomentsAdminPage.tsx`

**Pitfall:** În development, deschide UI pe Express (`:1994`), nu pe Vite (`:3000`), sau asigură-te că `vite.config.ts` proxiază `/api` → `:1994`.

---

### 💰 Financial Dashboard — aliniere semantică

- Progress bar galben (nu verde)
- „Bani primiți" în loc de „Avans încasat"
- Detaliu pe evenimente: sumele primite separate de cele rămase

**Fișier:** `src/client/features/admin/components/Financial/FinancialPage.tsx`

---

### 📅 Dashboard EventList — grupare pe ani

Tab „Viitoare" afișează 3 blocuri: **anul curent** (mereu deschis) + **2027** și **2028** (colapsabile), pentru clienți rezervați în avans.

**Fișier:** `src/client/features/admin/components/Dashboard/index.tsx`

---

### 📝 Mementos — draft persistent

- Modalul „Memento nou" nu se închide la click pe overlay
- Draft salvat în `localStorage` cu cheia `admin:mementos:add-draft`
- La redeschidere, draft-ul se reîncarcă automat
- Se șterge din localStorage doar la salvare reușită

**Fișier:** `src/client/features/admin/components/MementosPage.tsx`

---

### 🔧 Vite proxy — fix development API

`vite.config.ts` proxiază `/api` și `/triggerEvent` → Express `:1994`, astfel fetch-urile relative funcționează și când deschizi UI-ul pe portul Vite `:3000`.

**Fișier:** `vite.config.ts`
