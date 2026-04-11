export type ServiceType = "nunta" | "botez" | "majorat" | "evenimente";

export interface ReviewData {
  author: string;
  rating: 5;
  relativeDate: string;
  text: string;
}

export interface CityData {
  slug: string;
  name: string;
  county: string;
  description: string;
  intro: string;
  nearbyAreas: string[];
  venues: string[];
  photoSpots: string[];
}

export interface ServiceData {
  slug: ServiceType;
  name: string;
  accusative: string;
  plural: string;
  nameLong: string;
  description: string;
  shortPitch: string;
}

export interface LocationRoute {
  path: string;
  citySlug: string;
  serviceSlug: ServiceType;
  canonicalPath: string;
  keywordLabel: string;
}

export const GOOGLE_REVIEWS: ReviewData[] = [
  {
    author: "Diana Petcu",
    rating: 5,
    relativeDate: "acum o lună",
    text:
      "O experiență unică, profi de la începutul evenimentului până la final. Atât pozele, cât și clipurile sunt extraordinare.",
  },
  {
    author: "Noemi Emy",
    rating: 5,
    relativeDate: "acum un an",
    text:
      "Programarea spontană, pozele au ajuns foarte repede, iar experiența a fost relaxată și profesionistă.",
  },
  {
    author: "Diana Pîntea",
    rating: 5,
    relativeDate: "acum un an",
    text:
      "Pozele au ieșit superbe și surprind perfect emoțiile și momentele speciale. Fotograf serios, punctual și foarte atent la detalii.",
  },
  {
    author: "Emanuela Zaharie",
    rating: 5,
    relativeDate: "acum un an",
    text:
      "La botezul fetiței noastre, atenția la detalii și felul în care au surprins emoția evenimentului ne-au impresionat cu adevărat.",
  },
  {
    author: "Amy Outdoors And Beyond",
    rating: 5,
    relativeDate: "acum un an",
    text:
      "Am avut privilegiul de a lucra cu Dani Anca și a fost una dintre cele mai bune decizii pe care le-am luat pentru un moment important.",
  },
  {
    author: "GutTransport Sand",
    rating: 5,
    relativeDate: "acum un an",
    text:
      "Cea mai bună colaborare pe care am avut-o vreodată. Foarte serioși, foarte corecți și foarte ușor de recomandat.",
  },
];

export const CITIES: CityData[] = [
  {
    slug: "sibiu",
    name: "Sibiu",
    county: "Sibiu",
    description:
      "un oraș cu o arhitectură medievală de poveste și o atmosferă calmă, elegantă, perfectă pentru cadre naturale și rafinate",
    intro:
      "Lucrăm frecvent în Sibiu pentru nunți, botezuri și evenimente private, cu un stil discret și atent la emoție, nu doar la cadrele clasice.",
    nearbyAreas: ["Șelimbăr", "Cisnădie", "Avrig", "Mediaș"],
    venues: ["Centrul Vechi", "Muzeul Astra", "Turnul Sfatului", "Promenada Mall Events"],
    photoSpots: ["Piața Mare", "Podul Minciunilor", "Parcul Sub Arini"],
  },
  {
    slug: "cluj",
    name: "Cluj-Napoca",
    county: "Cluj",
    description:
      "cel mai dinamic oraș din Transilvania, cu energie urbană, locații premium și o mulțime de spații bune pentru portrete și cadre de seară",
    intro:
      "În Cluj-Napoca fotografiem și filmăm evenimente care cer ritm bun, organizare clară și livrare curată, indiferent dacă ziua începe în oraș sau lângă el.",
    nearbyAreas: ["Florești", "Apahida", "Baciu", "Dezmir"],
    venues: ["Grand Hotel Italia", "Boema", "Wonderland", "Chios Social Lounge"],
    photoSpots: ["Parcul Central", "Cetățuia", "Grădina Botanică"],
  },
  {
    slug: "dej",
    name: "Dej",
    county: "Cluj",
    description:
      "un oraș activ din nordul județului Cluj, potrivit pentru evenimente de familie și recepții unde contează ritmul bun și apropierea de invitați",
    intro:
      "În Dej lucrăm pentru evenimente unde contează naturalețea, organizarea și capacitatea de a surprinde rapid momentele importante fără să încărcăm programul zilei.",
    nearbyAreas: ["Jichișu de Jos", "Cuzdrioara", "Gherla", "Beclean"],
    venues: ["Grand Master Ballroom", "Park House Events", "Parc Royal", "Yasmin Ballroom"],
    photoSpots: ["Parcul Balnear Toroc", "Dealul Florilor", "centrul orașului"],
  },
  {
    slug: "gherla",
    name: "Gherla",
    county: "Cluj",
    description:
      "un oraș cu atmosferă liniștită și evenimente apropiate de familie, bun pentru imagini curate și portrete fără agitație",
    intro:
      "Pentru evenimente în Gherla păstrăm un stil discret, cu accent pe reacții reale, cadre curate și o prezență calmă pe tot parcursul zilei.",
    nearbyAreas: ["Bonțida", "Mintiu Gherlii", "Dej", "Fizeșu Gherlii"],
    venues: ["Elysee Ballroom", "Clasic Events", "Restaurant Etrusco", "Grand Karim"],
    photoSpots: ["Parcul Mare", "centrul istoric", "zonele verzi din apropiere"],
  },
  {
    slug: "huedin",
    name: "Huedin",
    county: "Cluj",
    description:
      "un oraș de tranzit cu evenimente de comunitate și familie, bun pentru acoperire foto-video completă fără complicații logistice",
    intro:
      "În Huedin și în zona de vest a județului Cluj acoperim evenimente unde contează mai ales ritmul, familia și livrarea rapidă a materialelor.",
    nearbyAreas: ["Aghireșu", "Călățele", "Poieni", "Negreni"],
    venues: ["La Castel Events", "Hanul Moților", "Miraje Events", "restauranturile din zonă"],
    photoSpots: ["centrul orașului", "zonele verzi din apropiere", "peisajele spre Vlădeasa"],
  },
  {
    slug: "alba-iulia",
    name: "Alba Iulia",
    county: "Alba",
    description:
      "orașul cetății și al spațiilor istorice ample, potrivit pentru imagini curate, luminoase și elegante",
    intro:
      "În Alba Iulia ne plac evenimentele cu ritm autentic și locațiile care permit cadre aerisite, naturale și filmări fluide pe tot parcursul zilei.",
    nearbyAreas: ["Sebeș", "Teiuș", "Aiud", "Vințu de Jos"],
    venues: ["La Maison de Caroline", "Mercur Events", "Allegria", "Cetatea Alba Carolina"],
    photoSpots: ["Poarta a III-a", "Catedrala Încoronării", "Șanțurile Cetății"],
  },
  {
    slug: "sebes",
    name: "Sebeș",
    county: "Alba",
    description:
      "un oraș bine conectat, cu multe evenimente private și acces rapid spre Alba Iulia și zona de munte, potrivit pentru cadre curate și eficiente",
    intro:
      "În Sebeș fotografiem și filmăm evenimente cu accent pe naturalețe și pe o documentare coerentă a zilei, de la momentele de familie până la petrecere.",
    nearbyAreas: ["Lancrăm", "Petrești", "Alba Iulia", "Cugir"],
    venues: ["Leul de Aur", "Domeniile Martinutzi", "Pensiunea Ryn", "restauranturile din Sebeș"],
    photoSpots: ["Parcul Arini", "centrul istoric", "Lancrăm"],
  },
  {
    slug: "aiud",
    name: "Aiud",
    county: "Alba",
    description:
      "un oraș potrivit pentru evenimente de familie și recepții apropiate, unde contează mai mult emoția autentică decât decorul încărcat",
    intro:
      "La evenimentele din Aiud venim cu o abordare simplă și eficientă, concentrată pe oameni, familie și cadre care rămân relevante peste ani.",
    nearbyAreas: ["Teiuș", "Unirea", "Alba Iulia", "Ocna Mureș"],
    venues: ["Theodora Golf Club", "La Conac", "Domeniile Boieru", "restauranturile locale"],
    photoSpots: ["Cetatea Aiudului", "centrul vechi", "podgoriile din zonă"],
  },
  {
    slug: "blaj",
    name: "Blaj",
    county: "Alba",
    description:
      "un oraș cu evenimente elegante și atmosferă calmă, bun pentru botezuri, nunți și recepții unde familia este în centru",
    intro:
      "În Blaj ne adaptăm ușor atât la evenimente restrânse, cât și la recepții mai mari, păstrând aceeași atenție pentru lumină și reacții reale.",
    nearbyAreas: ["Jidvei", "Teiuș", "Alba Iulia", "Mediaș"],
    venues: ["La Salcia", "Jidvei Events", "Târnava Events", "restauranturile din zonă"],
    photoSpots: ["Câmpia Libertății", "centrul Blajului", "podgoriile Jidvei"],
  },
  {
    slug: "cugir",
    name: "Cugir",
    county: "Alba",
    description:
      "un oraș din județul Alba unde evenimentele cer eficiență, prezență discretă și adaptare rapidă la programul real al zilei",
    intro:
      "Pentru evenimente în Cugir livrăm un mix clar de fotografie, videografie și foto-video, cu atenție pe momentele-cheie și pe dinamica invitaților.",
    nearbyAreas: ["Sebeș", "Șibot", "Șugag", "Orăștie"],
    venues: ["Riviera Events", "Ramada Hall", "La Maison", "restauranturile din apropiere"],
    photoSpots: ["centrul orașului", "zonele de deal din apropiere", "peisajele spre munte"],
  },
  {
    slug: "turda",
    name: "Turda",
    county: "Cluj",
    description:
      "un oraș cu ritm calm, aproape de zone spectaculoase precum Cheile Turzii și Salina Turda, foarte bun pentru cadre memorabile",
    intro:
      "Pentru evenimente în Turda, mizăm pe documentare reală, lumină bună și imagini care păstrează atmosfera zilei fără să o forțeze.",
    nearbyAreas: ["Câmpia Turzii", "Mihai Viteazu", "Săndulești", "Copăceni"],
    venues: ["Potaissa Turda", "Sarea-n Bucate", "Hunter Castle", "Ratiu House"],
    photoSpots: ["Salina Turda", "Cheile Turzii", "Castrul Roman Potaissa"],
  },
  {
    slug: "arad",
    name: "Arad",
    county: "Arad",
    description:
      "un oraș elegant din vest, cu arhitectură austro-ungară, săli mari de evenimente și un centru potrivit pentru cadre clasice",
    intro:
      "La evenimentele din Arad urmărim un mix echilibrat între momente spontane, portrete curate și secvențe video care păstrează energia reală a zilei.",
    nearbyAreas: ["Pecica", "Nădlac", "Curtici", "Sântana"],
    venues: ["Expo Arad", "Complex President", "Marem", "Hotel Continental Forum"],
    photoSpots: ["Palatul Administrativ", "Faleza Mureșului", "Parcul Reconcilierii"],
  },
  {
    slug: "brasov",
    name: "Brașov",
    county: "Brașov",
    description:
      "unul dintre cele mai spectaculoase orașe din România, cu centru vechi, arhitectură puternică și fundal montan foarte bun pentru portrete",
    intro:
      "Brașovul cere ritm bun și adaptare rapidă, mai ales la evenimentele care combină locații urbane cu ședințe foto în natură sau la marginea orașului.",
    nearbyAreas: ["Sânpetru", "Ghimbav", "Cristian", "Râșnov"],
    venues: ["Aro Palace", "Belvedere Events", "Kolping", "Qosmo Hotel"],
    photoSpots: ["Piața Sfatului", "Strada Sforii", "Belvedere Tâmpa"],
  },
  {
    slug: "targu-mures",
    name: "Târgu Mureș",
    county: "Mureș",
    description:
      "un oraș cu saloane elegante, arhitectură distinctă și multe evenimente de familie unde contează discreția și atenția la detalii",
    intro:
      "În Târgu Mureș lucrăm cu focus pe naturalețe, reacții reale și un flux clar al zilei, astfel încât galeria finală să rămână coerentă și vie.",
    nearbyAreas: ["Livezeni", "Sângeorgiu de Mureș", "Ungheni", "Ernei"],
    venues: ["Business Hotel Conference Center", "Privo", "President Events", "Apollo Palace"],
    photoSpots: ["Cetatea Medievală", "Piața Trandafirilor", "Complexul Weekend"],
  },
  {
    slug: "reghin",
    name: "Reghin",
    county: "Mureș",
    description:
      "un oraș cu evenimente familiale și comunitare unde contează apropierea de oameni, dinamica naturală și acoperirea completă a zilei",
    intro:
      "În Reghin lucrăm cu accent pe naturalețe și consecvență, astfel încât materialul final să surprindă atât familia, cât și atmosfera reală a evenimentului.",
    nearbyAreas: ["Petelea", "Sângeorgiu de Pădure", "Târgu Mureș", "Toplița"],
    venues: ["Monte Carlo Events", "Restaurant Casablanca", "Apollo Events", "restauranturile din zonă"],
    photoSpots: ["Parcul Central", "centrul orașului", "Pădurea Rotundă"],
  },
  {
    slug: "sighisoara",
    name: "Sighișoara",
    county: "Mureș",
    description:
      "un oraș istoric spectaculos, foarte bun pentru cadre foto și video elegante, mai ales la evenimente care includ și o sesiune scurtă în cetate",
    intro:
      "Sighișoara oferă un decor puternic, iar noi îl folosim doar cât trebuie, fără să pierdem focusul de pe oameni și de pe emoția reală a zilei.",
    nearbyAreas: ["Albești", "Daneș", "Saschiz", "Târgu Mureș"],
    venues: ["Cavaler Hotel", "BinderBubi", "Hotel Sighișoara", "restauranturile din cetate"],
    photoSpots: ["Cetatea Sighișoarei", "Turnul cu Ceas", "Scara Acoperită"],
  },
  {
    slug: "sovata",
    name: "Sovata",
    county: "Mureș",
    description:
      "o stațiune potrivită pentru evenimente cu atmosferă relaxată, portrete în natură și cadre care profită de lumină și peisaj",
    intro:
      "La evenimentele din Sovata combinăm documentarea discretă a zilei cu cadre de exterior care pun în valoare zona fără să încetinească programul.",
    nearbyAreas: ["Praid", "Corund", "Târgu Mureș", "Sărățeni"],
    venues: ["Danubius Sovata", "Fabesca Boutique", "Bradet", "Ensana Events"],
    photoSpots: ["Lacul Ursu", "aleile din stațiune", "zonele împădurite din jur"],
  },
  {
    slug: "ludus",
    name: "Luduș",
    county: "Mureș",
    description:
      "un oraș cu evenimente de familie apropiate și o comunitate caldă, unde contează să surprinzi sincer momentele, nu doar protocolul",
    intro:
      "La evenimentele din Luduș păstrăm lucrurile simple și bine făcute: imagini curate, ritm discret și atenție pe oamenii importanți ai zilei.",
    nearbyAreas: ["Iernut", "Cuci", "Chețani", "Sărmașu"],
    venues: ["Imperial Events", "Select Events", "Castel Haller", "Hanul Pescăresc"],
    photoSpots: ["Parcul Central", "Malul Mureșului", "domeniile din jurul orașului"],
  },
  {
    slug: "campia-turzii",
    name: "Câmpia Turzii",
    county: "Cluj",
    description:
      "un oraș în dezvoltare, cu evenimente apropiate de familie și acces rapid spre Turda și zone bune pentru sesiuni foto scurte",
    intro:
      "În Câmpia Turzii documentăm evenimentele cu accent pe atmosferă, familie și acele momente scurte care fac diferența în galeria finală.",
    nearbyAreas: ["Turda", "Luna", "Viișoara", "Moldovenești"],
    venues: ["La Broscuța", "Motel Milexim", "Hotel Andrei", "Rex Events"],
    photoSpots: ["Parcul Municipal", "zona Turzii", "Cheile Turzii"],
  },
  {
    slug: "oradea",
    name: "Oradea",
    county: "Bihor",
    description:
      "un oraș Art Nouveau cu lumină bună, centru elegant și multe cadre premium pentru ședințe foto înainte sau după eveniment",
    intro:
      "În Oradea lucrăm cel mai bine atunci când ziua are cursivitate, iar locațiile permit tranziții curate între pregătiri, ceremonie și petrecere.",
    nearbyAreas: ["Sânmartin", "Băile Felix", "Oșorhei", "Nojorid"],
    venues: ["Aristocrat Events Hall", "Lotus Therm", "Sky Palace", "DoubleTree by Hilton"],
    photoSpots: ["Piața Unirii", "Palatul Vulturul Negru", "Cetatea Oradea"],
  },
  {
    slug: "bistrita",
    name: "Bistrița",
    county: "Bistrița-Năsăud",
    description:
      "un oraș cochet din nordul Transilvaniei, cu centru istoric plăcut și multe evenimente unde contează apropierea de familie și naturalețea",
    intro:
      "Pentru nunți, botezuri și evenimente în Bistrița, venim cu o abordare calmă, bine organizată și cu accent pe momente reale, nu pe cadre forțate.",
    nearbyAreas: ["Livezile", "Unirea", "Năsăud", "Beclean"],
    venues: ["Metropolis", "Hotel Coroana de Aur", "Ozana", "Panoramic Colibița"],
    photoSpots: ["Centrul Vechi", "Biserica Evanghelică", "Colibița"],
  },
  {
    slug: "beclean",
    name: "Beclean",
    county: "Bistrița-Năsăud",
    description:
      "un oraș bun pentru evenimente private și petreceri de familie, cu acces ușor și multe locații din zonă folosite pentru recepții",
    intro:
      "În Beclean și în localitățile din jur documentăm evenimentele cu accent pe familie, pe atmosfera reală și pe un flux foto-video bine așezat.",
    nearbyAreas: ["Bistrița", "Figa", "Năsăud", "Lechința"],
    venues: ["Băile Figa Resort", "Panoramic Events", "Metropolis area", "restauranturile din Beclean"],
    photoSpots: ["Băile Figa", "centrul Becleanului", "zonele verzi din apropiere"],
  },
  {
    slug: "nasaud",
    name: "Năsăud",
    county: "Bistrița-Năsăud",
    description:
      "un oraș cu evenimente apropiate de comunitate și familie, unde discreția și atenția la momentele reale fac diferența în rezultatul final",
    intro:
      "La evenimentele din Năsăud venim cu o prezență calmă și o documentare curată, potrivită pentru nunți, botezuri și alte momente importante de familie.",
    nearbyAreas: ["Beclean", "Salva", "Sângeorz-Băi", "Bistrița"],
    venues: ["Paradis Events", "Castel Dracula area", "saloanele locale", "restauranturile din zonă"],
    photoSpots: ["centrul orașului", "Valea Someșului", "zonele montane din apropiere"],
  },
  {
    slug: "sangeorz-bai",
    name: "Sângeorz-Băi",
    county: "Bistrița-Năsăud",
    description:
      "o stațiune mică potrivită pentru evenimente cu atmosferă relaxată și cadre în natură, mai ales pentru familii care vor ceva mai calm",
    intro:
      "În Sângeorz-Băi acoperim evenimente unde contează atât apropierea de familie, cât și avantajul unui decor natural bun pentru portrete și cadre video.",
    nearbyAreas: ["Năsăud", "Maieru", "Rodna", "Bistrița"],
    venues: ["Hebe Events", "hotelurile din stațiune", "saloanele locale", "restaurantele din zonă"],
    photoSpots: ["parcul stațiunii", "zonele verzi", "Valea Someșului Mare"],
  },
  {
    slug: "medias",
    name: "Mediaș",
    county: "Sibiu",
    description:
      "un oraș transilvănean cu centru istoric bine conturat, bun pentru evenimente elegante și portrete cu lumină frumoasă",
    intro:
      "În Mediaș lucrăm pentru evenimente care cer echilibru între documentare discretă, portrete curate și un ritm bun pe tot parcursul zilei.",
    nearbyAreas: ["Copșa Mică", "Blaj", "Dumbrăveni", "Sibiu"],
    venues: ["Traube", "BinderBubi Mediaș", "Ametist Events", "restauranturile din zonă"],
    photoSpots: ["centrul istoric", "Turnul Trompeților", "piațetele vechi"],
  },
  {
    slug: "cisnadie",
    name: "Cisnădie",
    county: "Sibiu",
    description:
      "un oraș mic aproape de Sibiu, potrivit pentru nunți și botezuri unde contează apropierea de familie și logistica simplă",
    intro:
      "La evenimentele din Cisnădie ne concentrăm pe naturalețe, ritm și cadre care surprind familia fără să intrăm prea mult în desfășurarea zilei.",
    nearbyAreas: ["Sibiu", "Șelimbăr", "Cisnădioara", "Avrig"],
    venues: ["Apfelhaus", "Magnolia Events", "saloanele din Sibiu", "restauranturile din zonă"],
    photoSpots: ["Cisnădioara", "centrul vechi", "dealurile din apropiere"],
  },
  {
    slug: "avrig",
    name: "Avrig",
    county: "Sibiu",
    description:
      "un oraș cunoscut pentru zona Brukenthal și pentru evenimentele care combină locul elegant cu un ritm relaxat al zilei",
    intro:
      "În Avrig documentăm evenimente care profită de locațiile elegante și de spațiile verzi, păstrând însă accentul pe oameni și pe reacțiile reale.",
    nearbyAreas: ["Sibiu", "Cârțișoara", "Porumbacu de Jos", "Făgăraș"],
    venues: ["Palatul Brukenthal Avrig", "The Garden Events", "saloanele din zonă", "restauranturile locale"],
    photoSpots: ["Palatul Brukenthal", "grădinile domeniului", "zona Avrigului"],
  },
];

export const SERVICES: ServiceData[] = [
  {
    slug: "nunta",
    name: "Nuntă",
    accusative: "nunta",
    plural: "nunți",
    nameLong: "Fotografie, videografie și foto-video pentru nuntă",
    description:
      "Ziua nunții are nevoie de imagini care păstrează emoția reală, ritmul firesc și oamenii importanți, de la pregătiri până la ultima parte a petrecerii.",
    shortPitch: "pentru mirii care vor imagini curate, emoție reală și un flux relaxat pe tot parcursul zilei",
  },
  {
    slug: "botez",
    name: "Botez",
    accusative: "botezul",
    plural: "botezuri",
    nameLong: "Fotografie, videografie și foto-video pentru botez",
    description:
      "La botez surprindem emoția părinților, reacțiile familiei și toate detaliile care fac evenimentul memorabil fără să transformăm ziua într-o ședință foto rigidă.",
    shortPitch: "pentru familii care vor discreție, cadre naturale și imagini calde, ușor de revăzut ani la rând",
  },
  {
    slug: "majorat",
    name: "Majorat",
    accusative: "majoratul",
    plural: "majorate",
    nameLong: "Fotografie, videografie și foto-video pentru majorat",
    description:
      "La majorat contează energia, prietenii, reacțiile spontane și toate cadrele care păstrează vibe-ul real al serii fără să pară artificiale.",
    shortPitch: "pentru evenimente cu energie, atmosferă și cadre dinamice care trebuie surprinse rapid și curat",
  },
  {
    slug: "evenimente",
    name: "Evenimente",
    accusative: "evenimentul",
    plural: "evenimente",
    nameLong: "Fotografie, videografie și foto-video pentru evenimente private",
    description:
      "Oferim foto, video și pachete complete pentru evenimente private, aniversări, petreceri restrânse și momente de familie unde contează discreția și livrarea rapidă.",
    shortPitch: "pentru clienți care vor acoperire completă foto-video și un furnizor care se adaptează ușor la tipul evenimentului",
  },
];

const PRIMARY_KEYWORDS = [
  { template: (service: ServiceData, city: CityData) => `/foto-video-${service.slug}-${city.slug}`, label: "foto video" },
];

const ALIAS_KEYWORDS = [
  { template: (service: ServiceData, city: CityData) => `/fotograf-${service.slug}-${city.slug}`, label: "fotograf" },
  { template: (service: ServiceData, city: CityData) => `/videograf-${service.slug}-${city.slug}`, label: "videograf" },
  { template: (service: ServiceData, city: CityData) => `/foto-${service.slug}-${city.slug}`, label: "foto" },
  { template: (service: ServiceData, city: CityData) => `/video-${service.slug}-${city.slug}`, label: "video" },
  { template: (service: ServiceData, city: CityData) => `/foto-video-${city.slug}-${service.slug}`, label: "foto video" },
  { template: (service: ServiceData, city: CityData) => `/fotograf-${city.slug}-${service.slug}`, label: "fotograf" },
  { template: (service: ServiceData, city: CityData) => `/videograf-${city.slug}-${service.slug}`, label: "videograf" },
];

export function getCityBySlug(slug: string): CityData | undefined {
  return CITIES.find(c => c.slug === slug);
}

export function getServiceBySlug(slug: string): ServiceData | undefined {
  return SERVICES.find(s => s.slug === slug);
}

export const CANONICAL_LOCATION_ROUTES: LocationRoute[] = CITIES.flatMap(city =>
  SERVICES.map(service => ({
    path: PRIMARY_KEYWORDS[0].template(service, city),
    citySlug: city.slug,
    serviceSlug: service.slug,
    canonicalPath: PRIMARY_KEYWORDS[0].template(service, city),
    keywordLabel: PRIMARY_KEYWORDS[0].label,
  }))
);

export const ALL_LOCATION_ROUTES: LocationRoute[] = CITIES.flatMap(city =>
  SERVICES.flatMap(service => {
    const canonicalPath = PRIMARY_KEYWORDS[0].template(service, city);

    return [
      ...PRIMARY_KEYWORDS.map(keyword => ({
        path: keyword.template(service, city),
        citySlug: city.slug,
        serviceSlug: service.slug,
        canonicalPath,
        keywordLabel: keyword.label,
      })),
      ...ALIAS_KEYWORDS.map(keyword => ({
        path: keyword.template(service, city),
        citySlug: city.slug,
        serviceSlug: service.slug,
        canonicalPath,
        keywordLabel: keyword.label,
      })),
    ];
  })
);
