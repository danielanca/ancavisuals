# Ghidul AI din Dashboard: răspunde din datele reale

Data: 2026-10-28 · Stare: propunere, așteaptă aprobarea lui Dani

## De ce

Ghidul AI de sus de pe Dashboard (`AdminGuideChat` → `POST /api/admin/ai-assistant/guide`) știe azi doar lista paginilor din admin. Răspunde bine la „unde găsesc X”, dar la orice întrebare despre business („ce am weekendul ăsta?”, „cine n-a semnat contractul?”) nu are date. Dani: „Până acum s-a descurcat destul de bine, dar vreau să se descurce mult mai bine.”

Ținta: îl întrebi ceva despre evenimente, clienți, contracte, lead-uri, albume, taskuri sau prețuri, iar el caută singur în date și răspunde cu fapte și cu link spre pagina unde rezolvi.

## Obiective

- Răspunde din datele reale, căutate la momentul întrebării, nu dintr-un rezumat trimis de pagină.
- Poate vedea și prețurile: prețurile din `/admin/preturi` și sumele per eveniment/contract (total, avans, rest de plată). Dani: „poate să afle și prețul atunci, hai să fie.”
- Păstrează ce face acum: „unde găsesc X” → locul din meniu + link.
- Fiecare răspuns care se referă la ceva concret are link spre pagina din admin unde îl vezi sau îl rezolvi.
- Răspunde în română, scurt, ca un coleg care știe tot.

## Ce nu face (non-goals)

- Nu modifică, nu șterge și nu trimite nimic (nici email, nici SMS, nici WhatsApp). Doar citește. *(Decizia mea, nu a lui Dani.)*
- Nu înlocuiește asistentul de pe Financiar (`AiContextChat` din `FinancialPage`), care rămâne cum e.
- Nu e pentru clienți: chatul public de pe site rămâne Tidio.

## Ce ar însemna un eșec, chiar dacă merge tehnic

- Inventează: o dată, un nume sau o sumă care nu e în date. Mai rău decât „nu știu”.
- Răspunde cu date vechi sau din alt an fără să spună.
- Face o sumă, o numărătoare sau o comparație de date „din cap” și greșește.
- E lent, peste ~15 s pentru o întrebare obișnuită.
- Costă mult pe zi fără să se observe.

## Constrângeri

- Endpoint-ul rămâne `requireFirebaseAuth` + `requireSupremeAdmin`, ca acum: doar contul de owner.
- Cheia Anthropic rămâne pe server. Datele pleacă la Anthropic doar ca rezultate de tool, la fel ca la celelalte unelte AI din admin.
- Fusul orar: Europe/Bucharest. „Azi”, „weekendul ăsta”, „luna asta” se calculează pe server și se dau modelului.
- Costul se urmărește prin `createAnthropicClient` (deja numără consumul pe unealtă, în `aiUsageHistory`).
- Stilul UI: pătrat, monocrom (regula proprietarului), în componenta existentă `AiContextChat`.

## Cum funcționează (decis)

**Model cu unelte (tool use) pe server.** `POST /api/admin/ai-assistant/guide` devine o buclă de unelte: modelul primește întrebarea, data de azi, lista paginilor (ca acum) și un set de unelte **doar de citire**. Cheamă câte unelte îi trebuie (maximum ~8 runde), apoi răspunde. Clientul trimite doar mesajele, nu date.

**Uneltele** (fiecare întoarce JSON mic, doar câmpurile utile, limitat ca număr de rânduri):

| Unealtă | Ce întoarce |
|---|---|
| `find_events(from, to, type?, status?, text?)` | evenimente: id, client, tip, date, locație, status, cine merge, album (slug, câte poze), sume |
| `get_event(id)` | tot ce e util despre un eveniment, plus contract/proces-verbal legate și linkul din admin |
| `find_contracts(status?, from?, to?, text?)` | contracte: client, dată eveniment, status (draft/trimis/semnat), de când așteaptă, sume |
| `find_handovers(status?)` | procese-verbale: semnat/nesemnat, de când, eveniment |
| `find_leads(from?, to?, text?)` | lead-uri: nume, telefon, sursă, data evenimentului cerută, când a venit, starea emailului |
| `find_tasks(scope: overdue/upcoming/all)` | taskuri și remindere: ce, pentru cine, termen |
| `booked_dates(from, to)` | zile ocupate/libere |
| `get_prices(year?)` | prețurile din `/admin/preturi` (inclusiv anul cu prețuri proprii) |
| `album_status(slug sau eventId)` | originale/preview-uri/ZIP, upload neterminat |

Uneltele refolosesc funcțiile de server care există deja (ex. `getPriceBook`, `getYearPrices`, citirile din `adminEvents`, `contracts`, `materialsHandover`, `leads`, `reminders`/`clientTasks`, progresul uploadului), nu reimplementează reguli. Calculele (numărători, sume, „câte zile de atunci”) le fac uneltele, nu modelul.

**Linkuri.** Răspunsul are linkuri Markdown spre pagini din admin. Evenimentele n-au azi o pagină proprie: trăiesc ca carduri pe Dashboard. Un link de eveniment devine deci `/admin?event=<id>`, care deschide Dashboard-ul, derulează la card și îl deschide. Asta e o mică adăugare în Dashboard. *(Decizia mea.)* Contractele duc la `/admin/contracts/:id/edit`, procesele-verbale la `/admin/handover`, lead-urile la `/admin/leads`, taskurile la `/admin/taskuri`, iar brief-ul la `/admin/events/:eventId/brief`. Lista de căi permise = paginile din meniu (ca acum) + căile întoarse de unelte (ex. pagina unui eveniment). `isLinkablePath` din `AdminGuideChat` se lărgește în consecință.

**Promptul** spune clar: folosește doar ce întorc uneltele; dacă nu găsești, spune „nu găsesc” și ce ai căutat; scrie datele în română („sâmbătă, 14 iunie 2027”); fără liste lungi, cel mult 5 rânduri, cu „mai sunt N, vezi [pagina]”.

**Model:** `claude-opus-5-5`, efort mediu (răspunsurile cer căutare și raționament, nu doar navigare). Instrucțiunile + lista paginilor se pun în cache (`cache_control`), ca acum.

**UI:** același `AdminGuideChat`. În timp ce caută, arată pe scurt ce face („caut în evenimente…”), din numele ultimei unelte apelate. Placeholder nou cu un exemplu de întrebare despre date.

## Partea 2: căutarea din meniul din stânga

Azi (`DashboardSearch` din `AdminSidebar`): căutare fuzzy pe lista paginilor, maximum 8 rezultate. AI-ul intervine doar când nu găsește nimic și dă 1–2 fraze de text, fără variante pe care să dai click. Dani: „Dacă caut după ceva anume, să îmi dea mai multe variante.”

**Cum va merge:**
- Rezultatele locale rămân instant, ca acum.
- Sub ele apare un bloc „Sugestii AI”, cu până la 5 variante **pe care dai click**. Fiecare are titlu, un motiv scurt („contractul semnat pe 3 oct”) și link. Se navighează și cu săgețile și Enter, ca rezultatele locale.
- Variantele pot fi **pagini** din admin (din aceeași listă ca ghidul) sau **lucruri concrete** găsite cu aceleași unelte de citire: un eveniment, un client, un contract, un lead, un album. Exemple: „Popescu” → evenimentul, contractul și lead-ul lui; „poze nunta iunie” → albumele din iunie + pagina de upload; „preț fotocabină” → Prețuri.
- Pornește singur după ce te oprești din scris (~0,6 s, minimum 3 litere). Rezultatul se ține minte pentru aceeași căutare cât e pagina deschisă. Dacă tastezi mai departe, cererea veche se anulează.

**Server:** `POST /api/admin/ai-assistant/search` → `{ results: [{ title, reason, path, kind }] }`. Aceeași buclă de unelte ca ghidul, dar cu un singur scop: listă ordonată de variante, nu text. Căile se verifică pe server (doar pagini cunoscute sau căi întoarse de unelte); orice altceva se aruncă.

**Model:** mai rapid decât la ghid (Sonnet, efort mic), pentru că aici contează viteza. *(Decizia mea.)*

## Calcule făcute de mine (verifică-le)

- **Doar citire.** Fără acțiuni („trimite reminder”, „marchează sunat”). Se pot adăuga separat, cu confirmare.
- **Sume per eveniment și prețuri: da. Contabilitate: nu.** Încasări lunare, cheltuieli, facturi și extrase bancare rămân la asistentul de pe Financiar. Ai spus „prețul”, nu „contabilitatea”.
- **Modelul** e Opus cu efort mediu. Dacă se dovedește lent sau scump, se poate trece la Sonnet pentru întrebările simple.
- **Fără memorie între sesiuni.** Ține minte doar conversația deschisă (ultimele 20 de mesaje, ca acum).
- **Căutarea AI pornește singură** după o pauză în scris, nu doar la Enter. Costă câte un apel pe căutare; dacă iese prea scump, trece pe „apasă Enter pentru sugestii AI”.
- **Ordinea de construcție:** întâi uneltele de citire (comune), apoi ghidul, apoi căutarea.

## Lăsat constructorului

- Numele exacte ale câmpurilor din Firestore pentru fiecare unealtă și ce câmpuri se taie (păstrează JSON-ul mic).
- Limitele per unealtă (câte rânduri, ce interval implicit, de exemplu următoarele 30 de zile).
- Formatul exact al stării „caut în …” (polling, streaming sau doar un text generic).

## Cum verificăm că e „mult mai bine”

Un set de ~15 întrebări reale, cu răspunsul corect scos direct din Firestore, rulat înainte și după:
„ce am weekendul ăsta?”, „cine n-a semnat contractul?”, „ce procese-verbale sunt nesemnate de peste o săptămână?”, „la ce nunți n-am urcat pozele?”, „ce lead-uri au venit ieri?”, „e liber 12 iunie 2027?”, „cât costă foto + video la nuntă în 2028?”, „cât mai are de plătit X?”, „unde schimb prețurile?” (să nu se strice ghidul de acum) etc.

Teste automate: uneltele pe Firestore mock-uit (filtre, intervale, fus orar) și bucla de unelte cu un client Anthropic mock-uit (se oprește la limită, nu trimite date fără unealtă, linkuri doar spre căi permise).
