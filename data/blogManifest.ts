// AUTO-MAINTAINED — adaugă câte o intrare pentru fiecare fișier nou din data/blog/
// slug trebuie să corespundă exact cu numele fișierului .md (fără extensie)

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  city?: string;
}

export const BLOG_POSTS: BlogMeta[] = [
  // ── Articole generale ──────────────────────────────────────────────────────
  {
    slug: "ce-trebuie-sa-stii-la-nunta",
    title: "Ce trebuie să știi la o nuntă — ghid complet",
    description: "Tot ce trebuie să pregătești înainte de nuntă: programul zilei, protocoale, greșeli de evitat și sfaturi practice de la fotografi cu experiență.",
    date: "2026-06-01",
    category: "nunta",
    tags: ["nunta", "sfaturi", "organizare"],
  },
  {
    slug: "ghid-mireasa-prima-nunta",
    title: "Dacă ești mireasă pentru prima dată, citește asta",
    description: "Ghid sincer pentru miresele la primul lor mare eveniment: ce să aștepți, ce să delegi și cum să nu pierzi momentele importante.",
    date: "2026-06-02",
    category: "nunta",
    tags: ["nunta", "mireasa", "ghid"],
  },
  {
    slug: "fotograf-sau-videograf-nunta",
    title: "Fotograf sau videograf la nuntă? Diferența pe care nu o știai",
    description: "Comparam fotografia și videografia de nuntă: ce surprinde fiecare, cât costă și de ce pachetul combinat e alegerea cea mai bună.",
    date: "2026-06-03",
    category: "nunta",
    tags: ["nunta", "fotograf", "videograf"],
  },
  {
    slug: "acte-necesare-casatorie-primarie",
    title: "Acte necesare căsătorie primărie — lista completă 2026",
    description: "Lista completă de documente pentru depunerea dosarului de căsătorie la primărie în România. Ce acte pregătești, termene și costuri.",
    date: "2026-06-04",
    category: "acte",
    tags: ["casatorie", "acte", "primarie"],
  },
  {
    slug: "acte-necesare-botez",
    title: "Acte necesare botez — ce documente îți trebuie în 2026",
    description: "Ghid complet cu documentele necesare pentru botez la biserică și la starea civilă. Ce pregătești, cine semnează și ce termene respecți.",
    date: "2026-06-05",
    category: "acte",
    tags: ["botez", "acte", "biserica"],
  },
  {
    slug: "cum-sa-alegi-fotograful-de-nunta",
    title: "Cum să alegi fotograful de nuntă — 7 întrebări esențiale",
    description: "Ce să întrebi înainte să semnezi contractul cu un fotograf de nuntă. Portofoliu, stil, backup echipament și drepturile tale ca client.",
    date: "2026-06-06",
    category: "nunta",
    tags: ["nunta", "fotograf", "sfaturi"],
  },

  // ── Acte căsătorie per oraș ─────────────────────────────────────────────────
  { slug: "acte-casatorie-primarie-turda", title: "Acte necesare căsătorie primărie Turda — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Turda. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "turda"], city: "turda" },
  { slug: "acte-casatorie-primarie-cluj", title: "Acte necesare căsătorie primărie Cluj-Napoca — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Cluj-Napoca. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "cluj"], city: "cluj" },
  { slug: "acte-casatorie-primarie-sibiu", title: "Acte necesare căsătorie primărie Sibiu — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Sibiu. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "sibiu"], city: "sibiu" },
  { slug: "acte-casatorie-primarie-alba-iulia", title: "Acte necesare căsătorie primărie Alba Iulia — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Alba Iulia. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "alba-iulia"], city: "alba-iulia" },
  { slug: "acte-casatorie-primarie-arad", title: "Acte necesare căsătorie primărie Arad — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Arad. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "arad"], city: "arad" },
  { slug: "acte-casatorie-primarie-brasov", title: "Acte necesare căsătorie primărie Brașov — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Brașov. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "brasov"], city: "brasov" },
  { slug: "acte-casatorie-primarie-targu-mures", title: "Acte necesare căsătorie primărie Târgu Mureș — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Târgu Mureș. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "targu-mures"], city: "targu-mures" },
  { slug: "acte-casatorie-primarie-oradea", title: "Acte necesare căsătorie primărie Oradea — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Oradea. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "oradea"], city: "oradea" },
  { slug: "acte-casatorie-primarie-bistrita", title: "Acte necesare căsătorie primărie Bistrița — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Bistrița. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "bistrita"], city: "bistrita" },
  { slug: "acte-casatorie-primarie-dej", title: "Acte necesare căsătorie primărie Dej — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Dej. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "dej"], city: "dej" },
  { slug: "acte-casatorie-primarie-gherla", title: "Acte necesare căsătorie primărie Gherla — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Gherla. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "gherla"], city: "gherla" },
  { slug: "acte-casatorie-primarie-huedin", title: "Acte necesare căsătorie primărie Huedin — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Huedin. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "huedin"], city: "huedin" },
  { slug: "acte-casatorie-primarie-campia-turzii", title: "Acte necesare căsătorie primărie Câmpia Turzii — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Câmpia Turzii. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "campia-turzii"], city: "campia-turzii" },
  { slug: "acte-casatorie-primarie-sebes", title: "Acte necesare căsătorie primărie Sebeș — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Sebeș. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "sebes"], city: "sebes" },
  { slug: "acte-casatorie-primarie-aiud", title: "Acte necesare căsătorie primărie Aiud — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Aiud. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "aiud"], city: "aiud" },
  { slug: "acte-casatorie-primarie-blaj", title: "Acte necesare căsătorie primărie Blaj — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Blaj. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "blaj"], city: "blaj" },
  { slug: "acte-casatorie-primarie-cugir", title: "Acte necesare căsătorie primărie Cugir — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Cugir. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "cugir"], city: "cugir" },
  { slug: "acte-casatorie-primarie-reghin", title: "Acte necesare căsătorie primărie Reghin — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Reghin. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "reghin"], city: "reghin" },
  { slug: "acte-casatorie-primarie-sighisoara", title: "Acte necesare căsătorie primărie Sighișoara — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Sighișoara. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "sighisoara"], city: "sighisoara" },
  { slug: "acte-casatorie-primarie-sovata", title: "Acte necesare căsătorie primărie Sovata — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Sovata. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "sovata"], city: "sovata" },
  { slug: "acte-casatorie-primarie-ludus", title: "Acte necesare căsătorie primărie Luduș — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Luduș. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "ludus"], city: "ludus" },
  { slug: "acte-casatorie-primarie-medias", title: "Acte necesare căsătorie primărie Mediaș — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Mediaș. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "medias"], city: "medias" },
  { slug: "acte-casatorie-primarie-cisnadie", title: "Acte necesare căsătorie primărie Cisnădie — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Cisnădie. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "cisnadie"], city: "cisnadie" },
  { slug: "acte-casatorie-primarie-avrig", title: "Acte necesare căsătorie primărie Avrig — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Avrig. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "avrig"], city: "avrig" },
  { slug: "acte-casatorie-primarie-beclean", title: "Acte necesare căsătorie primărie Beclean — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Beclean. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "beclean"], city: "beclean" },
  { slug: "acte-casatorie-primarie-nasaud", title: "Acte necesare căsătorie primărie Năsăud — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Năsăud. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "nasaud"], city: "nasaud" },
  { slug: "acte-casatorie-primarie-sangeorz-bai", title: "Acte necesare căsătorie primărie Sângeorz-Băi — ghid 2026", description: "Lista documentelor pentru dosarul de căsătorie la Primăria Sângeorz-Băi. Termene, taxe și sfaturi practice.", date: "2026-06-10", category: "acte", tags: ["casatorie", "acte", "sangeorz-bai"], city: "sangeorz-bai" },

  // ── Acte botez per oraș ─────────────────────────────────────────────────────
  { slug: "acte-botez-turda", title: "Acte necesare botez Turda — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Turda. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "turda"], city: "turda" },
  { slug: "acte-botez-cluj", title: "Acte necesare botez Cluj-Napoca — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Cluj-Napoca. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "cluj"], city: "cluj" },
  { slug: "acte-botez-sibiu", title: "Acte necesare botez Sibiu — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Sibiu. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "sibiu"], city: "sibiu" },
  { slug: "acte-botez-alba-iulia", title: "Acte necesare botez Alba Iulia — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Alba Iulia. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "alba-iulia"], city: "alba-iulia" },
  { slug: "acte-botez-arad", title: "Acte necesare botez Arad — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Arad. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "arad"], city: "arad" },
  { slug: "acte-botez-brasov", title: "Acte necesare botez Brașov — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Brașov. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "brasov"], city: "brasov" },
  { slug: "acte-botez-targu-mures", title: "Acte necesare botez Târgu Mureș — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Târgu Mureș. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "targu-mures"], city: "targu-mures" },
  { slug: "acte-botez-oradea", title: "Acte necesare botez Oradea — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Oradea. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "oradea"], city: "oradea" },
  { slug: "acte-botez-bistrita", title: "Acte necesare botez Bistrița — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Bistrița. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "bistrita"], city: "bistrita" },
  { slug: "acte-botez-dej", title: "Acte necesare botez Dej — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Dej. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "dej"], city: "dej" },
  { slug: "acte-botez-gherla", title: "Acte necesare botez Gherla — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Gherla. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "gherla"], city: "gherla" },
  { slug: "acte-botez-huedin", title: "Acte necesare botez Huedin — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Huedin. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "huedin"], city: "huedin" },
  { slug: "acte-botez-campia-turzii", title: "Acte necesare botez Câmpia Turzii — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Câmpia Turzii. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "campia-turzii"], city: "campia-turzii" },
  { slug: "acte-botez-sebes", title: "Acte necesare botez Sebeș — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Sebeș. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "sebes"], city: "sebes" },
  { slug: "acte-botez-aiud", title: "Acte necesare botez Aiud — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Aiud. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "aiud"], city: "aiud" },
  { slug: "acte-botez-blaj", title: "Acte necesare botez Blaj — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Blaj. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "blaj"], city: "blaj" },
  { slug: "acte-botez-cugir", title: "Acte necesare botez Cugir — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Cugir. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "cugir"], city: "cugir" },
  { slug: "acte-botez-reghin", title: "Acte necesare botez Reghin — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Reghin. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "reghin"], city: "reghin" },
  { slug: "acte-botez-sighisoara", title: "Acte necesare botez Sighișoara — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Sighișoara. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "sighisoara"], city: "sighisoara" },
  { slug: "acte-botez-sovata", title: "Acte necesare botez Sovata — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Sovata. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "sovata"], city: "sovata" },
  { slug: "acte-botez-ludus", title: "Acte necesare botez Luduș — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Luduș. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "ludus"], city: "ludus" },
  { slug: "acte-botez-medias", title: "Acte necesare botez Mediaș — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Mediaș. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "medias"], city: "medias" },
  { slug: "acte-botez-cisnadie", title: "Acte necesare botez Cisnădie — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Cisnădie. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "cisnadie"], city: "cisnadie" },
  { slug: "acte-botez-avrig", title: "Acte necesare botez Avrig — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Avrig. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "avrig"], city: "avrig" },
  { slug: "acte-botez-beclean", title: "Acte necesare botez Beclean — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Beclean. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "beclean"], city: "beclean" },
  { slug: "acte-botez-nasaud", title: "Acte necesare botez Năsăud — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Năsăud. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "nasaud"], city: "nasaud" },
  { slug: "acte-botez-sangeorz-bai", title: "Acte necesare botez Sângeorz-Băi — ghid complet 2026", description: "Ce documente pregătești pentru botez la biserica și starea civilă din Sângeorz-Băi. Lista completă, termene și sfaturi.", date: "2026-06-20", category: "acte", tags: ["botez", "acte", "sangeorz-bai"], city: "sangeorz-bai" },
];

export function getPostMeta(slug: string): BlogMeta | undefined {
  return BLOG_POSTS.find(p => p.slug === slug);
}
