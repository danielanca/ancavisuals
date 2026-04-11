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
#STACK  src/__tests__    → teste Vitest (client + server)
#STACK  public           → asset-uri statice
#STACK  data/blog        → articole Markdown pentru blog
#STACK  data/            → fișiere de date statice (blogManifest.ts, prices.json etc.)

---

## COMENZI #CMD

#CMD  dev:                npm run dev
#CMD  typecheck:          npm run typecheck
#CMD  test:               npm test
#CMD  build:              npm run build
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

---

## QR MOMENTS #QR

#QR  Route:   src/server/routes/QRMoment.routes.ts  ← casing exact
#QR  Service: src/server/services/qrMoment.service.ts
#QR  Teste:   src/__tests__/server/services/QRMoment.services.test.ts

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
#CI  Node:      momentan 19 în workflow și `.nvmrc`
#CI  Atenție:   CI rulează pe Linux — case sensitivity diferă față de macOS

---

## CAPCANE CUNOSCUTE #PITFALL

#PITFALL  ipinfo.ts ← nu ipInfo.ts  (case sensitivity macOS vs Linux CI)
#PITFALL  QRMoment.routes.ts ← nu qrMoment.routes.ts
#PITFALL  Onboardingwizard.tsx ← nu OnboardingWizard.tsx
#PITFALL  tsconfig: forceConsistentCasingInFileNames: true → pică în CI
#PITFALL  vitest: nu acceptă flag-uri Jest-style (ex: --runInBand)
#PITFALL  SSR: renderToString sincron → nu folosi fetch async pentru date SSR
#PITFALL  blog: articol fără intrare în blogManifest.ts → SSR fără meta tags
#PITFALL  worktree: nu reseta schimbări care nu sunt ale tale fără git status

---

## DEBUGGING RAPID #DEBUG

#DEBUG  Cannot find module  → rg --files src | rg '<modul>'  apoi verifică casing
#DEBUG  Trece local, pică CI → suspectează casing / fișier necomis / versiune Node
#DEBUG  Problemă doar în build → importuri ESM, extensii, path-uri generate
#DEBUG  Verificare completă: npm run typecheck && npm test

---

## RECENT CHANGES #RECENT

#RECENT  2026-04-11  Adăugat AGENTS.md ca entrypoint scurt pentru agenți; AI_MEMORY.md rămâne sursa principală de context
#RECENT  2026-04-11  Restructurat AI_MEMORY.md cu tag-uri rg-friendly (#TAG pe fiecare linie)
#RECENT  2026-04-11  Blog SEO: 60 articole Markdown + API /api/blog + pagini /blog și /blog/:slug
#RECENT  2026-04-11  data/blogManifest.ts: index static pentru SSR meta tags
#RECENT  2026-04-11  src/client/utils/theme.ts: constanta ACCENT (amber-200)
#RECENT  2026-04-11  Contact /contact: hero scurtat, BookingWizard mutat direct după hero
#RECENT  2026-04-11  Bugfix importuri: ipinfo.ts, QRMoment.routes, Onboardingwizard
#RECENT  2026-04-11  GitHub Actions actualizat la checkout@v4 + setup-node@v4
#RECENT  2026-04-11  Workflow păstrat pe Node 19 pentru compatibilitate; upgrade la 20/22 rămâne separat
