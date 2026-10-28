# Ghidul AI cu date reale + căutare AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghidul AI de pe Dashboard și căutarea din meniul din stânga răspund din datele reale din Firestore (evenimente, contracte, procese-verbale, lead-uri, taskuri, zile ocupate, prețuri, albume), prin unelte read-only, cu linkuri spre admin.

**Architecture:** Un modul de unelte read-only (`adminDataTools.ts`) peste Firestore + o buclă generică de tool use (`adminToolLoop.ts`). `POST /api/admin/ai-assistant/guide` folosește bucla ca să răspundă în text. Noul `POST /api/admin/ai-assistant/search` o folosește ca să întoarcă variante ordonate pe care dai click. Clientul (`AdminGuideChat`, `DashboardSearch`) doar afișează și leagă linkurile; Dashboard-ul deschide un eveniment din `?event=<id>`.

**Tech Stack:** Express + firebase-admin (server), `@anthropic-ai/sdk` prin `createAnthropicClient`, React (admin), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-admin-ai-guide-data-design.md`

## Global Constraints

- Uneltele doar citesc: nicio scriere în Firestore, niciun email, SMS sau WhatsApp.
- Endpoint-urile rămân sub `requireFirebaseAuth` + `requireSupremeAdmin` (router-ul o face deja).
- Fusul orar pentru „azi”, intervale și afișare: `Europe/Bucharest`.
- Prețurile și sumele per eveniment/contract sunt permise. Contabilitatea (facturi, cheltuieli, extrase, încasări lunare) NU intră în unelte.
- Ghid: model `claude-opus-5-5`, `output_config: { effort: "medium" }`, maximum 8 runde de unelte, iar ultima rundă are `tool_choice: { type: "none" }`. Instrucțiunile și lista paginilor stau în system, cu `cache_control: { type: "ephemeral" }`.
- Căutare: model `claude-sonnet-4-6`, maximum 3 runde, cel mult 5 rezultate.
- Răspunsurile se scriu în română. Listele au cel mult 5 rânduri, apoi „mai sunt N, vezi [pagina]”.
- Calculele (numărători, sume, zile scurse) le fac uneltele, nu modelul.
- Linkurile acceptate sunt doar căile din lista paginilor admin și căile întoarse de unelte (câmpul `link`). Orice altă cale se aruncă pe server și nu devine link în client.
- Stil UI: pătrat, monocrom (fără colțuri rotunde noi, fără accente aurii sau verzi noi).
- Nu face commit. Dani commit-uiește singur. Fiecare task se încheie cu testele trecute.
- La final: o intrare nouă sus în `src/shared/adminChangelog.ts` (linkuri doar spre căi din `adminRoutes.tsx`) și o linie `#RECENT` în `AI_MEMORY.md`.

## Review Focus

1. Nume cu sau fără diacritice și cu altă majusculă („stefan” vs „Ștefan Pop”) trebuie să găsească același client. Testul e în Task 1.
2. Evenimente pe mai multe zile (`eventDates`, `eventEndDate`) și `eventDate` venit fie ca Timestamp, fie ca string: un eveniment intră în interval dacă oricare zi a lui e în interval. Testul e în Task 1.
3. Întrebări pe la miezul nopții: „azi” e ziua din București, nu din UTC (ex. 2026-10-28T22:30Z = 29 oct în București). Testul e în Task 1.
4. Cereri cu foarte multe rezultate („toate evenimentele”): unealta întoarce `total` + primele 50 de rânduri + `more: true`, nu tot. Testul e în Task 1.
5. Linkuri inventate de model (`/admin/ceva-inexistent`, `https://…`, `javascript:`): eliminate din `links` pe server și afișate ca text simplu în client. Testele sunt în Task 2 (server) și Task 4 (client).

---

### Task 1: Unelte read-only peste date

**Files:**
- Create: `src/server/services/adminDataTools.ts`
- Test: `tests/vitest/server/services/adminDataTools.test.ts`

**Interfaces:**
- Consumes: `firestore()` din `src/server/firestore`, `expandEventDates` din `src/server/utils/expandEventDates`, `approvedFamilyDays` din `src/server/services/familyTime.service`, `getPriceBook`/`getYearPrices` din `src/server/routes/startingPrices.routes`, `getAlbumUploadProgress` din `src/server/services/albumUploadNotifications`.
- Produces:
  - `type ToolRows = { total: number; rows: Record<string, unknown>[]; more: boolean }` (fiecare rând are `link: string` când există o pagină)
  - `ADMIN_DATA_TOOLS: Anthropic.Tool[]`
  - `ADMIN_DATA_HANDLERS: Record<string, (input: Record<string, unknown>, now?: Date) => Promise<unknown>>`
  - `ADMIN_DATA_TOOL_LABELS: Record<string, string>` (ex. `find_events: "Evenimente"`)
  - `romaniaToday(now: Date): string` (YYYY-MM-DD în București)
  - `normalizeText(value: string): string` (fără diacritice, litere mici)
  - `MAX_TOOL_ROWS = 50`

Uneltele și câmpurile (citesc colecția întreagă și filtrează în memorie, ca `publicBookedDates.routes.ts`):

| Unealtă | Input | Colecție → câmpuri întoarse | `link` |
|---|---|---|---|
| `find_events` | `from?`, `to?` (YYYY-MM-DD, implicit azi → +30 zile), `type?`, `status?`, `text?` | `adminEvents` → id, `client.fullName`, `client.phone`, type, status, zile (din `expandEventDates`), services, albumSlug, `pricing.total/advanceAmount/advancePaid/remainingAmount`, `delivery.*`, contractId | `/admin?event=<id>` |
| `get_event` | `id` | același rând + notes + contractul legat (status, signedAt) + procesul-verbal legat (status, signedAt) | `/admin?event=<id>` |
| `find_contracts` | `status?` (draft/sent/signed), `from?`, `to?`, `text?` | `contracts` → id, clientName, eventType, eventDate, eventLocation, status, sentAt, signedAt, `daysWaiting` (de la sentAt dacă nesemnat), priceTotal, priceAdvance, priceRest, advancePaidAt, restPaidAt | `/admin/contracts/<id>/edit` |
| `find_handovers` | `status?`, `text?` | `materialsHandover` → id, clientName, eventType, eventDate, status, sentAt, signedAt, `daysWaiting` | `/admin/handover` |
| `find_leads` | `from?`, `to?` (după createdAt, implicit ultimele 30 de zile), `text?`, `includeArchived?` | `leads` → id, name, phone, source, eventType, eventDate, location, createdAt, emailStatus, archived | `/admin/leads` |
| `find_tasks` | `scope`: `overdue` / `upcoming` / `all` | `clientTasks` → id, title, clientName, status, dueDate/plannedFor, priority (`overdue` = nefinalizat cu termen < azi; `upcoming` = următoarele 7 zile) | `/admin/taskuri` |
| `booked_dates` | `from`, `to` | `adminEvents` cu status `confirmat`/`finalizat` și fără `excludeFromCalendar` + `approvedFamilyDays()` → `{ booked: string[], free: string[] }` | `/admin/calendar` |
| `get_prices` | `year?` | `getPriceBook()`, iar pentru `year` cu prețuri proprii, `getYearPrices()[year]` | `/admin/preturi` |
| `album_status` | `eventId` | slug, upload neterminat (`getAlbumUploadProgress`: expected, pending.length, lastActivityAt) | `/admin?event=<id>` |

Câmpuri care NU se întorc niciodată: semnături (`*SignatureBase64`), `token`, `clientIp`, `clientUserAgent`, `clientIdSeries`, `clientIBAN`, `bankIban`, `clauses`, `postEventBackupConfirmationToken`, `timelineActionTokenHash`.

- [ ] **Step 1: Write the failing tests** (Firestore mock-uit prin `vi.doMock("src/server/firestore")`, ca în `financeAssistant.routes.test.ts`)

```ts
test("romaniaToday uses Bucharest, not UTC", () => {
  expect(romaniaToday(new Date("2026-10-28T22:30:00Z"))).toBe("2026-10-29");
});
test("find_events matches names without diacritics or case", async () => {
  // adminEvents: { client: { fullName: "Ștefan Pop" }, eventDate: "2026-11-07", status: "confirmat" }
  const out = await ADMIN_DATA_HANDLERS.find_events({ text: "stefan", from: "2026-11-01", to: "2026-11-30" }) as ToolRows;
  expect(out.rows.map((r) => r.client)).toEqual(["Ștefan Pop"]);
});
test("find_events includes a multi-day event when any of its days is in range", async () => {
  // eventDate Timestamp 2026-11-06, eventEndDate "2026-11-08"; range 2026-11-08..2026-11-08
  expect((await ADMIN_DATA_HANDLERS.find_events({ from: "2026-11-08", to: "2026-11-08" }) as ToolRows).total).toBe(1);
});
test("caps big results with total and more", async () => {
  // 120 events in range
  const out = await ADMIN_DATA_HANDLERS.find_events({ from: "2026-01-01", to: "2026-12-31" }) as ToolRows;
  expect([out.total, out.rows.length, out.more]).toEqual([120, MAX_TOOL_ROWS, true]);
});
test("find_contracts counts days waiting for unsigned ones and never returns signatures or tokens", async () => {
  // contract: status "sent", sentAt 2026-10-20, clientSignatureBase64, token, clientIBAN
  const out = await ADMIN_DATA_HANDLERS.find_contracts({ status: "sent" }, new Date("2026-10-28T10:00:00Z")) as ToolRows;
  expect(out.rows[0]).toMatchObject({ daysWaiting: 8, link: "/admin/contracts/c1/edit" });
  expect(JSON.stringify(out)).not.toMatch(/Signature|token|IBAN/i);
});
test("find_tasks overdue = not done and due before today (Bucharest)", async () => { /* due 2026-10-27 open → in; done → out */ });
test("booked_dates lists booked and free days in the range, family days count as booked", async () => { /* … */ });
test("get_prices returns the year's own prices when they exist", async () => { /* getYearPrices → { "2028": { nunta: 1400 } } */ });
test("every tool in ADMIN_DATA_TOOLS has a handler and a label", () => {
  for (const tool of ADMIN_DATA_TOOLS) {
    expect(ADMIN_DATA_HANDLERS[tool.name]).toBeTypeOf("function");
    expect(ADMIN_DATA_TOOL_LABELS[tool.name]).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/vitest/server/services/adminDataTools.test.ts`
Expected: FAIL (`Cannot find module …adminDataTools`)

- [ ] **Step 3: Implement `adminDataTools.ts`** with the exports above. Descrierile uneltelor (`description` în `ADMIN_DATA_TOOLS`) sunt în română și spun când se folosește fiecare unealtă și ce înseamnă câmpurile cu bani (total, avans, rest). Datele din răspuns sunt YYYY-MM-DD.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/vitest/server/services/adminDataTools.test.ts`
Expected: PASS

---

### Task 2: Bucla de unelte

**Files:**
- Create: `src/server/services/adminToolLoop.ts`
- Test: `tests/vitest/server/services/adminToolLoop.test.ts`

**Interfaces:**
- Consumes: `ADMIN_DATA_HANDLERS`, `ADMIN_DATA_TOOL_LABELS` (Task 1) — passed in, not imported, so the loop stays generic.
- Produces:
  - `runToolLoop(options: { client: Anthropic; model: string; system: Anthropic.TextBlockParam[]; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[]; handlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>>; labels: Record<string, string>; maxRounds: number; maxTokens: number; effort: "low" | "medium" }): Promise<{ text: string; sources: string[]; links: string[]; refused: boolean }>`
    - `links` = toate valorile `link` din rândurile întoarse de unelte (deduplicate).
  - `allowedLinks(text: string, allowed: Set<string>): string` — înlocuiește `[x](/cale)` cu `x` când calea (fără `?`/`#`, cu excepția `/admin?event=<id>`) nu e în `allowed`.

- [ ] **Step 1: Write the failing tests** (client Anthropic fals: `{ messages: { create: vi.fn() } }`)

```ts
test("runs tools until the model answers, collecting sources and links", async () => {
  // create #1 → tool_use find_events; #2 → end_turn "Ai 1 eveniment: [Pop](/admin?event=e1)"
  const out = await runToolLoop({ ...base, handlers: { find_events: async () => ({ total: 1, rows: [{ link: "/admin?event=e1" }], more: false }) } });
  expect(out).toMatchObject({ text: expect.stringContaining("Pop"), sources: ["Evenimente"], links: ["/admin?event=e1"] });
});
test("last round forbids tools", async () => {
  // create always returns tool_use; maxRounds 2
  await runToolLoop({ ...base, maxRounds: 2 });
  expect(create.mock.calls[2][0].tool_choice).toEqual({ type: "none" });
});
test("unknown tool and a throwing handler become is_error results, not a crash", async () => { /* … */ });
test("refusal returns refused: true", async () => { /* stop_reason "refusal" */ });
test("allowedLinks drops invented paths, external and javascript: links", () => {
  const allowed = new Set(["/admin/preturi", "/admin?event=e1"]);
  expect(allowedLinks("[P](/admin/preturi) [X](/admin/nu-exista) [E](/admin?event=e1) [J](javascript:alert(1)) [H](https://x.ro)", allowed))
    .toBe("[P](/admin/preturi) X [E](/admin?event=e1) J H");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/vitest/server/services/adminToolLoop.test.ts`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement** după modelul buclei din `financeAssistant.routes.ts` (aceleași `tool_result` / `is_error`), cu `output_config: { effort }` și `system` primit gata cu `cache_control`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/vitest/server/services/adminToolLoop.test.ts`
Expected: PASS

---

### Task 3: Ghidul răspunde din date (server)

**Files:**
- Modify: `src/server/routes/adminAiAssistant.routes.ts` (handler-ul `/guide` și `GUIDE_INSTRUCTIONS`)
- Test: `tests/vitest/server/routes/adminAiAssistantGuide.routes.test.ts`

**Interfaces:**
- Consumes: `runToolLoop`, `allowedLinks` (Task 2); `ADMIN_DATA_TOOLS`, `ADMIN_DATA_HANDLERS`, `ADMIN_DATA_TOOL_LABELS`, `romaniaToday` (Task 1).
- Produces: `POST /api/admin/ai-assistant/guide` → `{ reply: string; sources: string[] }`. Body neschimbat: `{ messages, pages }`.

`GUIDE_INSTRUCTIONS` rescris: ghidul răspunde la „unde găsesc X” (ca acum) ȘI la întrebări despre date, folosind uneltele. Reguli din spec: doar ce întorc uneltele, „nu găsesc” + ce a căutat, date scrise în română („sâmbătă, 14 iunie 2027”), cel mult 5 rânduri, link pe fiecare lucru concret, fără `**` sau titluri. Un al doilea bloc de system (fără cache, se schimbă zilnic): `Azi: <ziua săptămânii>, <romaniaToday> (Europe/Bucharest).`

- [ ] **Step 1: Update/add tests**

```ts
test("guide uses the data tools and the cached page list", async () => {
  const { handler, createMock } = await loadGuide({ stop_reason: "end_turn", content: [{ type: "text", text: "Gata" }] });
  await handler({ body: { messages: [{ role: "user", content: "ce am weekendul ăsta?" }], pages } }, createMockResponse());
  const call = createMock.mock.calls[0][0];
  expect(call.model).toBe("claude-opus-5-5");
  expect(call.tools.map((t: any) => t.name)).toContain("find_events");
  expect(call.system[0].cache_control).toEqual({ type: "ephemeral" });
  expect(call.system[1].text).toMatch(/^Azi: /);
});
test("links outside the page list and tool links come back as plain text", async () => { /* reply "[X](/admin/nu-exista)" → "X" */ });
// păstrează testele existente: refuz → mesaj simplu, mesaje goale → 400
```

- [ ] **Step 2: Run to verify the new ones fail**

Run: `npx vitest run tests/vitest/server/routes/adminAiAssistantGuide.routes.test.ts`
Expected: FAIL on the new tests

- [ ] **Step 3: Implement** `/guide` cu `runToolLoop` (`maxRounds: 8`, `maxTokens: 4096`, `effort: "medium"`). Setul permis = căile din `pages` + `links` din buclă. `reply = allowedLinks(text, allowed)`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/vitest/server/routes/adminAiAssistantGuide.routes.test.ts`
Expected: PASS

---

### Task 4: Ghidul în client + deschiderea unui eveniment din link

**Files:**
- Modify: `src/client/features/admin/components/AdminGuideChat.tsx` (`isKnownPath`, `placeholder`)
- Modify: `src/client/features/admin/components/EventList.tsx` (deschide cardul din `?event=`)
- Test: `tests/vitest/client/features/admin/AdminGuideChat.test.tsx`, `tests/vitest/client/features/admin/eventDeepLink.test.tsx` (nou)

**Interfaces:**
- Consumes: forma linkurilor din Task 1 (`/admin?event=<id>`, `/admin/contracts/<id>/edit`, `/admin/events/<id>/brief`, `/admin/handover`, `/admin/leads`, `/admin/taskuri`, `/admin/calendar`, `/admin/preturi`).
- Produces: `isGuideLinkPath(path: string): boolean` exportat din `AdminGuideChat.tsx` = pagină cunoscută SAU unul dintre tiparele de mai sus (id-uri `[A-Za-z0-9_-]+`).

- [ ] **Step 1: Write the failing tests**

```ts
test("guide links: known pages and data links yes, anything else no", () => {
  expect(isGuideLinkPath("/admin?event=abc123")).toBe(true);
  expect(isGuideLinkPath("/admin/contracts/c1/edit")).toBe(true);
  expect(isGuideLinkPath("/admin/nu-exista")).toBe(false);
  expect(isGuideLinkPath("/admin?event=../x")).toBe(false);
});
test("the placeholder suggests a data question", () => { /* placeholder "Ex: ce am weekendul ăsta? cine n-a semnat contractul?" */ });
test("/admin?event=e2 opens that card and scrolls to it", async () => {
  // EventList with events e1, e2; MemoryRouter initialEntries ["/admin?event=e2"]
  // expect EventCard e2 rendered with initialCollapsed=false; scrollIntoView called on its element
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/vitest/client/features/admin/AdminGuideChat.test.tsx tests/vitest/client/features/admin/eventDeepLink.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement.** În `AdminGuideChat`: `placeholder` nou, iar cât așteaptă răspunsul afișează „Caut în date…”, printr-o proprietate nouă opțională `loadingText` pe `AiContextChat`. Restul paginilor care folosesc `AiContextChat` rămân neschimbate. `EventList` citește `event` din `useSearchParams()`. Cardul cu acel id primește `initialCollapsed={false}`, iar după montare se face `scrollIntoView({ block: "start" })` pe elementul lui (un `id="event-<id>"` pe wrapper). Dacă evenimentul e într-o secțiune pliată sau filtrată, secțiunea se deschide.

- [ ] **Step 4: Run to verify they pass**

Run: same command
Expected: PASS

---

### Task 5: Căutarea AI din meniul din stânga

**Files:**
- Modify: `src/server/routes/adminAiAssistant.routes.ts` (nou `POST /search`)
- Modify: `src/client/features/admin/components/DashboardSearch.tsx` (blocul „Sugestii AI” înlocuiește `askAi`/`aiAnswer`)
- Test: `tests/vitest/server/routes/adminAiAssistantSearch.routes.test.ts` (nou), `tests/vitest/client/features/admin/dashboardSearchAi.test.tsx` (nou)

**Interfaces:**
- Consumes: `runToolLoop`, `allowedLinks` (Task 2); uneltele (Task 1); `isGuideLinkPath` (Task 4).
- Produces:
  - `POST /api/admin/ai-assistant/search` body `{ query: string (3–200 caractere), pages }` → `{ results: { title: string; reason: string; path: string; kind: "page" | "event" | "contract" | "handover" | "lead" | "task" | "album" | "prices" }[] }`, cel mult 5.
  - Modelul răspunde cu JSON `{"results":[…]}`. Serverul îl parsează (cu `jsonrepair`, deja folosit în SEO Radar) și păstrează doar rezultatele cu `path` în setul permis (pagini + `links` din buclă).

- [ ] **Step 1: Write the failing tests**

```ts
// server
test("returns at most 5 clickable results with allowed paths only", async () => {
  // model JSON has 7 results, one with "/admin/nu-exista", one with "https://x"
  expect(res.json).toHaveBeenCalledWith({ results: expect.any(Array) });
  expect(results).toHaveLength(5);
  expect(results.every((r) => allowed.has(r.path.split(/[?#]/)[0]) || r.path.startsWith("/admin?event="))).toBe(true);
});
test("uses Sonnet with at most 3 rounds", async () => { /* model "claude-sonnet-4-6"; 4th create never called */ });
test("query shorter than 3 characters → 400", async () => { /* … */ });
// client
test("after a 600 ms pause shows AI suggestions under the local results, clickable and keyboard-navigable", async () => {
  // fake timers; type "Popescu"; advance 600 ms; fetch resolved → 2 results
  // expect "Sugestii AI" heading, ArrowDown past the local results reaches them, Enter navigates to result.path
});
test("typing again cancels the previous request and the same query is not asked twice", async () => {
  // type "Pope", wait, type "Popescu", wait → first request's AbortSignal aborted; retype "Popescu" → no new fetch
});
test("under 3 letters no AI request", async () => { /* … */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/vitest/server/routes/adminAiAssistantSearch.routes.test.ts tests/vitest/client/features/admin/dashboardSearchAi.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement.** Server: `runToolLoop` cu `model: "claude-sonnet-4-6"`, `maxRounds: 3`, `maxTokens: 1500`, `effort: "low"`. Instrucțiunile cer JSON pur cu cel mult 5 rezultate, cel mai probabil primul, plus un motiv scurt (sub 60 de caractere). Client: debounce de 600 ms, `AbortController` pe cererea în curs, cache `Map<query, results>` cât trăiește componenta. Blocul „Sugestii AI” stă sub rezultatele locale, cu aceleași stiluri de rând. În timpul cererii afișează „Caut cu AI…”. La eroare afișează un rând discret „Sugestiile AI nu sunt disponibile acum.”

- [ ] **Step 4: Run to verify they pass**

Run: same command
Expected: PASS

---

### Task 6: Setul de întrebări de verificare + finalizare

**Files:**
- Create: `scripts/adminGuideEval.ts`
- Modify: `src/shared/adminChangelog.ts`, `AI_MEMORY.md`

**Interfaces:**
- Consumes: handler-ul `/guide` (Task 3), apelat direct cu un `res` fals, ca în teste, dar cu Firestore și Anthropic reale.
- Produces: `npx tsx scripts/adminGuideEval.ts` → pentru fiecare întrebare afișează întrebarea, răspunsul, uneltele apelate și răspunsul corect calculat direct din Firestore, ca să se poată compara.

Întrebările (din spec): „ce am weekendul ăsta?”, „cine n-a semnat contractul?”, „ce procese-verbale sunt nesemnate de peste o săptămână?”, „la ce nunți n-am urcat pozele?”, „ce lead-uri au venit ieri?”, „e liber 12 iunie 2027?”, „cât costă foto + video la nuntă în 2028?”, „cât mai are de plătit <primul client cu rest > 0>?”, „ce taskuri am restante?”, „câte nunți am în 2027?”, „ce am luna viitoare?”, „unde schimb prețurile?”, „unde văd lead-urile?”, „cine e clientul de pe <cea mai apropiată dată>?”, „ce avans a plătit <un client>?”.

- [ ] **Step 1: Write the script** (read-only; răspunsul corect pentru fiecare întrebare e calculat cu aceleași funcții din Task 1, apelate direct).
- [ ] **Step 2: Run it** — `npx tsx scripts/adminGuideEval.ts`. Expected: fiecare răspuns se potrivește cu valoarea corectă afișată lângă el. Notează și dă-i lui Dani orice nepotrivire.
- [ ] **Step 3: Changelog + AI_MEMORY.** Intrare nouă sus în `ADMIN_CHANGELOG`, cu linkuri doar spre `/admin` și alte căi din `adminRoutes.tsx`. Linie `#RECENT 2026-10-28` în `AI_MEMORY.md` cu fișierele noi, endpoint-urile și regula „uneltele doar citesc; contabilitatea nu intră”.
- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc fără erori. În vitest pică doar testele care picau deja înainte de plan (`availabilityResult` ×2, `campaignVideoPlayer`, `adminEvents` „registers a sanitized manifest”, `handover.routes` „POST /sign/:token”, `feedbackAi.service`).
