# Changelog & Feature Reference

Fiecare secțiune documentează ce s-a construit, fișierele implicate și cum funcționează.

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
