export type ServiceType = "nunta" | "botez" | "majorat" | "evenimente" | "cununie-civila" | "logodna" | "corporate" | "inmormantare" | "trash-the-dress" | "save-the-date";

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
  services?: ServiceType[]; // if set, only these services generate pages for this city
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
    slug: "timisoara",
    name: "Timișoara",
    county: "Timiș",
    description:
      "cel mai mare oraș din vestul României, cu o vibrație cosmopolită, locații premium și o scenă de evenimente bine pusă la punct",
    intro:
      "În Timișoara acoperim nunți, botezuri și evenimente private cu un stil curat, ritm bun și atenție la detaliile care fac diferența în galeria finală.",
    nearbyAreas: ["Giroc", "Dumbrăvița", "Ghiroda", "Moșnița Nouă"],
    venues: ["Grand Hotel Continental", "Savoy Events", "Mercure Timișoara", "Palatul Braunschweig"],
    photoSpots: ["Piața Victoriei", "Piața Unirii", "Parcul Rozelor"],
  },
  {
    slug: "targu-lapus",
    name: "Târgu Lăpuș",
    county: "Maramureș",
    description:
      "un oraș din inima Maramureșului, cu evenimente de familie calde, tradiții puternice și un cadru natural autentic",
    intro:
      "La evenimentele din Târgu Lăpuș documentăm cu respect față de tradiție și cu atenție la momentele reale, de la familie până la atmosfera specifică locului.",
    nearbyAreas: ["Copalnic-Mănăștur", "Groși", "Cupșeni", "Suciu de Sus"],
    venues: ["saloanele locale", "Pensiunea Moieciu", "restaurantele din centru", "locațiile din zonă"],
    photoSpots: ["centrul orașului", "dealurile din jur", "Valea Lăpușului"],
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
  {
    slug: "zalau",
    name: "Zalău",
    county: "Sălaj",
    description:
      "reședința județului Sălaj, cu o comunitate caldă și evenimente de familie unde contează naturalețea și acoperirea completă a zilei",
    intro:
      "În Zalău fotografiem și filmăm evenimente cu un stil curat și un ritm discret, potrivit pentru familii care vor imagini autentice.",
    nearbyAreas: ["Șimleu Silvaniei", "Jibou", "Cehu Silvaniei", "Cluj-Napoca"],
    venues: ["Grand Restaurant", "saloanele din centru", "restauranturile locale", "locațiile din zonă"],
    photoSpots: ["centrul orașului", "Porolissum", "zonele verzi din apropiere"],
  },
  {
    slug: "deva",
    name: "Deva",
    county: "Hunedoara",
    description:
      "un oraș cu Cetatea Devei ca fundal spectaculos, potrivit pentru cadre memorabile și evenimente elegante cu personalitate",
    intro:
      "La evenimentele din Deva valorificăm contextul unic al cetății și al orașului, cu o documentare curată și un ritm bine adaptat la ziua respectivă.",
    nearbyAreas: ["Simeria", "Hunedoara", "Orăștie", "Brad"],
    venues: ["Hotel Sarmis", "Colosseum Events", "Belvedere", "restauranturile din centru"],
    photoSpots: ["Cetatea Devei", "Parcul Cetății", "centrul orașului"],
  },
  {
    slug: "hunedoara",
    name: "Hunedoara",
    county: "Hunedoara",
    description:
      "un oraș cu Castelul Corvinilor în fundal, unul dintre cele mai spectaculoase decoare medievale din România pentru evenimente și ședințe foto",
    intro:
      "În Hunedoara cadrul istoric e puternic — îl folosim inteligent, fără să copleșim imaginile, cu accent pe emoție și pe oamenii zilei.",
    nearbyAreas: ["Deva", "Simeria", "Călan", "Hațeg"],
    venues: ["Castelul Corvinilor area", "saloanele din centru", "restauranturile locale", "locațiile din Deva"],
    photoSpots: ["Castelul Corvinilor", "Parcul Dendrologic", "centrul vechi"],
  },
  {
    slug: "sfantu-gheorghe",
    name: "Sfântu Gheorghe",
    county: "Covasna",
    description:
      "reședința județului Covasna, cu o comunitate vibrantă și un mix de tradiții care face evenimentele să aibă personalitate proprie",
    intro:
      "La evenimentele din Sfântu Gheorghe ne adaptăm natural la ritmul zilei și la specificul local, documentând cu atenție fiecare moment important.",
    nearbyAreas: ["Târgu Secuiesc", "Covasna", "Bixad", "Brașov"],
    venues: ["Sugás Hotel", "saloanele din centru", "restauranturile locale", "locațiile din zonă"],
    photoSpots: ["Parcul Municipal", "centrul orașului", "zonele verzi din apropiere"],
  },
  {
    slug: "miercurea-ciuc",
    name: "Miercurea Ciuc",
    county: "Harghita",
    description:
      "un oraș cu atmosferă autentică și tradiții puternice, unde evenimentele de familie au o căldură aparte și un caracter unic",
    intro:
      "În Miercurea Ciuc documentăm evenimentele cu respect față de tradiție și cu atenție la momentele reale, de la familie până la atmosfera locului.",
    nearbyAreas: ["Cristuru Secuiesc", "Odorheiu Secuiesc", "Gheorgheni", "Toplița"],
    venues: ["Főnix Hotel", "saloanele din centru", "restauranturile locale", "locațiile din zonă"],
    photoSpots: ["centrul orașului", "Lacul Jigodin", "Parcul Municipal"],
  },
  {
    slug: "odorheiu-secuiesc",
    name: "Odorheiu Secuiesc",
    county: "Harghita",
    description:
      "un oraș pitoresc cu events de familie, cadre curate și o comunitate apropiată care pune preț pe autenticitate",
    intro:
      "La evenimentele din Odorheiu Secuiesc venim cu o abordare discretă și autentică, concentrată pe oameni și pe emoția reală a zilei.",
    nearbyAreas: ["Cristuru Secuiesc", "Miercurea Ciuc", "Sovata", "Sighișoara"],
    venues: ["Târnava Hotel", "saloanele locale", "restauranturile din centru", "locațiile din zonă"],
    photoSpots: ["centrul vechi", "Piața Primăriei", "zonele verzi din apropiere"],
  },
  {
    slug: "fagaras",
    name: "Făgăraș",
    county: "Brașov",
    description:
      "un oraș cu Cetatea Făgărașului și Munții Făgăraș în fundal, potrivit pentru cadre naturale spectaculoase și evenimente cu personalitate",
    intro:
      "În Făgăraș avem cadrul natural și istoric la dispoziție — îl integrăm în documentare fără să distragă atenția de la oamenii zilei.",
    nearbyAreas: ["Avrig", "Victoria", "Brașov", "Sibiu"],
    venues: ["Cetatea Făgărașului area", "restauranturile din centru", "saloanele locale", "locațiile din zonă"],
    photoSpots: ["Cetatea Făgărașului", "centrul orașului", "Munții Făgăraș"],
  },
  {
    slug: "sinaia",
    name: "Sinaia",
    county: "Prahova",
    description:
      "perla Carpaților, cu Castelul Peleș și un decor montan spectaculos — una dintre destinațiile favorite pentru nunți de vis și ședințe foto elegante",
    intro:
      "La evenimentele din Sinaia mizăm pe decorul natural excepțional, pe cadre elegante și pe o documentare curată care pune în valoare locul și oamenii.",
    nearbyAreas: ["Predeal", "Bușteni", "Azuga", "Comarnic"],
    venues: ["Castelul Peleș area", "Palace Hotel", "Rina Sinaia", "Montana Hotel"],
    photoSpots: ["Castelul Peleș", "Castelul Pelișor", "Parcul Dimitrie Ghica"],
  },
  {
    slug: "predeal",
    name: "Predeal",
    county: "Brașov",
    description:
      "cea mai înaltă stațiune din România, cu aer de munte, peisaje curate și un ritm relaxat — ideal pentru eventos intime și ședințe foto în natură",
    intro:
      "În Predeal documentăm evenimente unde natura face jumătate din treabă — noi ne concentrăm pe oameni, pe lumina de munte și pe momentele autentice.",
    nearbyAreas: ["Sinaia", "Azuga", "Brașov", "Râșnov"],
    venues: ["Rozmarin Hotel", "Cioplea Hotel", "Cerbul", "locațiile din zonă"],
    photoSpots: ["pârtiile și pădurile din jur", "centrul stațiunii", "Dealul Clăbucet"],
  },
  {
    slug: "baia-mare",
    name: "Baia Mare",
    county: "Maramureș",
    description:
      "cel mai mare oraș din Maramureș, cu viață culturală bogată, locații bune și evenimente cu tradiție și energie proprie",
    intro:
      "La evenimentele din Baia Mare livrăm foto-video cu un stil curat și un ritm adaptat la programul real al zilei, de la pregătiri până la petrecere.",
    nearbyAreas: ["Tăuții-Măgherăuș", "Baia Sprie", "Sighetu Marmației", "Cavnic"],
    venues: ["Hotel Eurohotel", "Riviera Events", "saloanele din centru", "restauranturile locale"],
    photoSpots: ["Piața Libertății", "Turnul Ștefan", "Parcul Municipal"],
  },
  {
    slug: "satu-mare",
    name: "Satu Mare",
    county: "Satu Mare",
    description:
      "un oraș cu influențe centrale-europene, clădiri elegante și o scenă de evenimente activă, bun pentru nunți clasice și botezuri cu familie mare",
    intro:
      "În Satu Mare acoperim evenimente cu un stil echilibrat, curat și adaptat la ritmul familiei, cu livrare rapidă și atenție la detalii.",
    nearbyAreas: ["Carei", "Ardud", "Negrești-Oaș", "Zalău"],
    venues: ["Hotel Dacia", "Astoria Events", "Melody Hall", "saloanele din centru"],
    photoSpots: ["Piața Libertății", "Turnul Pompierilor", "Parcul Dodici"],
  },
  {
    slug: "petrosani",
    name: "Petroșani",
    county: "Hunedoara",
    description:
      "centrul Văii Jiului, un oraș cu comunitate puternică și evenimente de familie unde apropierea și autenticitatea sunt pe primul loc",
    intro:
      "La evenimentele din Petroșani venim cu o documentare sinceră, adaptată la ritmul specific al zilei și la importanța momentelor de familie.",
    nearbyAreas: ["Vulcan", "Lupeni", "Uricani", "Deva"],
    venues: ["saloanele din centru", "restauranturile locale", "hotelurile din zonă", "locațiile din Vale"],
    photoSpots: ["centrul orașului", "zonele montane din jur", "Parâng"],
  },
  {
    slug: "orastie",
    name: "Orăștie",
    county: "Hunedoara",
    description:
      "un oraș cu istorie dacică bogată și evenimente de familie calde, bun pentru documentare autentică și cadre naturale",
    intro:
      "La evenimentele din Orăștie documentăm cu atenție la specificul local și la momentele care fac ziua memorabilă pentru toată familia.",
    nearbyAreas: ["Deva", "Simeria", "Călan", "Sebeș"],
    venues: ["saloanele din centru", "restauranturile locale", "locațiile din zonă", "Costești area"],
    photoSpots: ["Sarmizegetusa Regia", "centrul vechi", "zonele verzi"],
  },
  {
    slug: "toplita",
    name: "Toplița",
    county: "Harghita",
    description:
      "un orășel la poalele munților, cu natură autentică și evenimente de familie cu atmosferă caldă și tradițională",
    intro:
      "La evenimentele din Toplița mizăm pe autenticitate, natură și cadre curate care surprind familia fără artificii inutile.",
    nearbyAreas: ["Gheorgheni", "Reghin", "Miercurea Ciuc", "Ditrău"],
    venues: ["saloanele locale", "restauranturile din centru", "pensiunile din zonă", "locațiile din apropiere"],
    photoSpots: ["centrul orașului", "Parcul Mureșul", "zonele montane din jur"],
  },
  {
    slug: "gheorgheni",
    name: "Gheorgheni",
    county: "Harghita",
    description:
      "un oraș din inima Harghitei, cu peisaje spectaculoase și evenimente de familie cu caracter autentic și comunitar",
    intro:
      "La evenimentele din Gheorgheni documentăm cu respect față de tradiție și cu atenție la momentele care fac ziua specială pentru familie.",
    nearbyAreas: ["Toplița", "Borsec", "Ditrău", "Miercurea Ciuc"],
    venues: ["saloanele locale", "hotelurile din centru", "restauranturile din zonă", "locațiile din apropiere"],
    photoSpots: ["centrul orașului", "Lacul Roșu", "Cheile Bicazului"],
  },

  // --- Sate și comune lângă Oradea — doar nuntă ---
  {
    slug: "sanmartin-bihor",
    name: "Sânmartin",
    county: "Bihor",
    description: "comună lângă Oradea, cunoscută pentru Băile Felix, cu locații de evenimente elegante și acces ușor din Oradea",
    intro: "La nunțile din Sânmartin și Băile Felix livrăm acoperire completă foto-video, cu un ritm relaxat și cadre care valorifică locul.",
    nearbyAreas: ["Oradea", "Băile Felix", "Tășnad", "Nojorid"],
    venues: ["Termal Hotel", "saloanele din Băile Felix", "locațiile din zonă"],
    photoSpots: ["Băile Felix", "zonele verzi", "locațiile elegante din stațiune"],
    services: ["nunta"],
  },
  {
    slug: "baile-felix",
    name: "Băile Felix",
    county: "Bihor",
    description: "stațiune termală lângă Oradea, cu hoteluri cu săli de nunți elegante și o atmosferă relaxată pentru evenimente mari",
    intro: "Nunțile din Băile Felix au avantajul locațiilor cu tot confortul sub un acoperiș — documentăm tot, de la pregătiri până la petrecere.",
    nearbyAreas: ["Sânmartin", "Oradea", "Nojorid", "Biharia"],
    venues: ["Termal Hotel", "Lotus Therm", "International Hotel", "saloanele din stațiune"],
    photoSpots: ["parcul stațiunii", "lacurile termale", "aleile din Felix"],
    services: ["nunta"],
  },
  {
    slug: "nojorid",
    name: "Nojorid",
    county: "Bihor",
    description: "comună lângă Oradea, cu acces rapid și evenimente de familie calde, potrivite pentru nunți mai restrânse sau majorate",
    intro: "La nunțile din Nojorid și comunele din apropierea Oradei venim cu același profesionalism ca în oraș, fără costuri suplimentare.",
    nearbyAreas: ["Oradea", "Sânmartin", "Girișu de Criș", "Biharia"],
    venues: ["saloanele locale", "restauranturile din zonă", "locațiile din Oradea"],
    photoSpots: ["zonele verzi din comună", "drumul spre Oradea", "locuri naturale din jur"],
    services: ["nunta"],
  },
  {
    slug: "biharia",
    name: "Biharia",
    county: "Bihor",
    description: "comună cu tradiție lângă Oradea, cu nunți mari de familie și o comunitate apropiată unde contează naturalețea și sinceritatea",
    intro: "La nunțile din Biharia documentăm cu atenție la tradiție și la momentele de familie, cu un stil discret și livrat rapid.",
    nearbyAreas: ["Oradea", "Sântandrei", "Girișu de Criș", "Borș"],
    venues: ["saloanele locale", "restauranturile din comună", "locațiile din Oradea"],
    photoSpots: ["centrul comunei", "zonele verzi", "Cetatea Biharia"],
    services: ["nunta"],
  },
  {
    slug: "santandrei-bihor",
    name: "Sântandrei",
    county: "Bihor",
    description: "comună lângă Oradea cu acces rapid, nunți de familie și o comunitate caldă unde contează apropierea și livrarea rapidă",
    intro: "La nunțile din Sântandrei acoperim evenimentul complet, cu același standard ca în Oradea și fără deplasare suplimentară.",
    nearbyAreas: ["Oradea", "Biharia", "Nojorid", "Paleu"],
    venues: ["saloanele locale", "restauranturile din zonă", "locațiile din Oradea"],
    photoSpots: ["centrul comunei", "zonele verzi", "împrejurimile"],
    services: ["nunta"],
  },
  {
    slug: "salonta",
    name: "Salonta",
    county: "Bihor",
    description: "oraș lângă granița cu Ungaria, cu evenimente de familie mari și o comunitate unde tradițiile de nuntă sunt păstrate cu drag",
    intro: "La nunțile din Salonta livrăm foto-video complet, cu atenție la specificul local și la momentele care fac diferența în galeria finală.",
    nearbyAreas: ["Oradea", "Sântana", "Curtici", "Tulca"],
    venues: ["saloanele din centru", "restauranturile locale", "locațiile din zonă"],
    photoSpots: ["Turnul Vânătorilor", "centrul orașului", "zonele verzi"],
    services: ["nunta"],
  },
  {
    slug: "beius",
    name: "Beiuș",
    county: "Bihor",
    description: "oraș la poalele Apusenilor, cu nunți de familie autentice și un cadru natural bun pentru portrete și cadre video memorabile",
    intro: "La nunțile din Beiuș combinăm documentarea completă a evenimentului cu cadre care valorifică frumusețea zonei Apuseni.",
    nearbyAreas: ["Oradea", "Ștei", "Vașcău", "Drăgănești"],
    venues: ["saloanele din centru", "restauranturile locale", "locațiile din zonă"],
    photoSpots: ["centrul orașului", "Pădurea Neagră", "zonele montane din jur"],
    services: ["nunta"],
  },

  // --- Sate și comune lângă Arad — doar nuntă ---
  {
    slug: "vladimirescu",
    name: "Vladimirescu",
    county: "Arad",
    description: "suburbie a Aradului cu acces rapid, unde se organizează frecvent nunți mari cu familie extinsă și tradiții puternice",
    intro: "La nunțile din Vladimirescu și împrejurimile Aradului livrăm acoperire foto-video completă fără costuri de deplasare.",
    nearbyAreas: ["Arad", "Șiria", "Ghioroc", "Mândruloc"],
    venues: ["saloanele din Vladimirescu", "restauranturile locale", "locațiile din Arad"],
    photoSpots: ["zonele verzi", "via spre Arad", "locuri din apropierea Mureșului"],
    services: ["nunta"],
  },
  {
    slug: "ghioroc",
    name: "Ghioroc",
    county: "Arad",
    description: "comună cu lac și vie lângă Arad, cu nunți organizate în locații cu specific de zonă viticolă și atmosferă autentică",
    intro: "Nunțile din Ghioroc și zona viticolă de lângă Arad au un farmec aparte — documentăm totul cu atenție la locul și la oamenii zilei.",
    nearbyAreas: ["Arad", "Miniș", "Pauliș", "Șiria"],
    venues: ["locațiile cu specific de vie", "saloanele din zonă", "restauranturile locale"],
    photoSpots: ["lacul Ghioroc", "podgoriile din zonă", "peisajele viticole"],
    services: ["nunta"],
  },
  {
    slug: "paulis",
    name: "Păuliș",
    county: "Arad",
    description: "comună viticolă lângă Arad cu cadre memorabile pentru nunți, podgorii frumoase și locații cu specific autentic arădean",
    intro: "La nunțile din Păuliș valorificăm podgoriile și peisajul viticol pentru cadre memorabile, cu o documentare completă a evenimentului.",
    nearbyAreas: ["Arad", "Ghioroc", "Miniș", "Lipova"],
    venues: ["cramele și locațiile viticole", "saloanele din zonă", "restauranturile locale"],
    photoSpots: ["podgoriile din Păuliș", "peisajele viticole", "zonele de deal"],
    services: ["nunta"],
  },
  {
    slug: "lipova",
    name: "Lipova",
    county: "Arad",
    description: "oraș pe Mureș lângă Arad, cu tradiții puternice de nuntă și locații bune pentru evenimentele de familie mari",
    intro: "La nunțile din Lipova documentăm complet ziua, cu atenție la tradiție și la momentele de familie care fac diferența în galeria finală.",
    nearbyAreas: ["Arad", "Radna", "Păuliș", "Sebiș"],
    venues: ["saloanele din centru", "restauranturile locale", "Mânăstirea Radna area"],
    photoSpots: ["Mânăstirea Radna", "malul Mureșului", "centrul Lipovei"],
    services: ["nunta"],
  },
  {
    slug: "pecica",
    name: "Pecica",
    county: "Arad",
    description: "comună mare lângă Arad cu nunți de familie extinse și o comunitate unde tradițiile sunt respectate și celebrate cu bucurie",
    intro: "La nunțile din Pecica livrăm acoperire foto-video completă, adaptată la ritmul și la tradițiile specifice zonei de câmpie arădeane.",
    nearbyAreas: ["Arad", "Nădlac", "Sântana", "Turnu"],
    venues: ["saloanele locale", "restauranturile din centru", "locațiile din zonă"],
    photoSpots: ["centrul comunei", "malul Mureșului", "zonele verzi din jur"],
    services: ["nunta"],
  },
  {
    slug: "santana-arad",
    name: "Sântana",
    county: "Arad",
    description: "oraș lângă Arad cu comunitate activă și nunți mari de familie unde contează naturalețea și acoperirea completă a zilei",
    intro: "La nunțile din Sântana documentăm cu același profesionalism ca în Arad, cu un ritm adaptat la eveniment și livrare rapidă.",
    nearbyAreas: ["Arad", "Pecica", "Zimandu Nou", "Curtici"],
    venues: ["saloanele din centru", "restauranturile locale", "locațiile din zonă"],
    photoSpots: ["centrul orașului", "zonele verzi", "împrejurimile"],
    services: ["nunta"],
  },
  {
    slug: "curtici",
    name: "Curtici",
    county: "Arad",
    description: "comună la granița cu Ungaria, cu nunți mari de familie și o comunitate diversă unde evenimentele sunt momente de bucurie colectivă",
    intro: "La nunțile din Curtici venim cu acoperire completă și un stil discret, adaptat la specificul local și la dimensiunea evenimentului.",
    nearbyAreas: ["Arad", "Nădlac", "Sântana", "Dorobanți"],
    venues: ["saloanele locale", "restauranturile din zonă", "locațiile din Arad"],
    photoSpots: ["centrul comunei", "zonele verzi", "împrejurimile"],
    services: ["nunta"],
  },

  // --- Sate și comune lângă Turda — doar nuntă ---
  {
    slug: "mihai-viteazu",
    name: "Mihai Viteazu",
    county: "Cluj",
    description: "comună lângă Turda și Cheile Turzii, cu nunți de familie și un cadru natural spectaculos în apropiere",
    intro: "La nunțile din Mihai Viteazu combinăm documentarea completă cu cadre care valorifică proximitatea față de Cheile Turzii.",
    nearbyAreas: ["Turda", "Câmpia Turzii", "Copăceni", "Săndulești"],
    venues: ["saloanele locale", "locațiile din Turda", "restauranturile din zonă"],
    photoSpots: ["Cheile Turzii", "Salina Turda", "zonele naturale din apropiere"],
    services: ["nunta"],
  },
  {
    slug: "sandulesti",
    name: "Săndulești",
    county: "Cluj",
    description: "comună pitorească lângă Turda, cu nunți de familie autentice și acces facil spre Cheile Turzii pentru cadre memorabile",
    intro: "La nunțile din Săndulești documentăm complet evenimentul și valorificăm peisajul superb din apropierea Cheilor Turzii.",
    nearbyAreas: ["Turda", "Mihai Viteazu", "Petreștii de Jos", "Moldovenești"],
    venues: ["saloanele locale", "locațiile din Turda", "pensiunile din zonă"],
    photoSpots: ["Cheile Turzii", "peisajele de deal", "zonele naturale"],
    services: ["nunta"],
  },
  {
    slug: "luna-de-sus",
    name: "Luna de Sus",
    county: "Cluj",
    description: "comună între Cluj și Turda, cu nunți de familie calde și acces rapid spre locațiile premium din ambele orașe",
    intro: "La nunțile din Luna de Sus și zona dintre Cluj și Turda livrăm acoperire completă fără deplasare suplimentară.",
    nearbyAreas: ["Turda", "Cluj-Napoca", "Câmpia Turzii", "Apahida"],
    venues: ["saloanele locale", "locațiile din Cluj și Turda", "restauranturile din zonă"],
    photoSpots: ["zonele verzi", "peisajele din vale", "împrejurimile"],
    services: ["nunta"],
  },
  {
    slug: "moldovenesti",
    name: "Moldovenești",
    county: "Cluj",
    description: "comună de munte lângă Turda, cu nunți intime și un cadru natural autentic potrivit pentru imagini memorabile",
    intro: "La nunțile din Moldovenești valorificăm cadrul natural al zonei de deal și documentăm complet evenimentul.",
    nearbyAreas: ["Turda", "Săndulești", "Iara", "Petreștii de Jos"],
    venues: ["saloanele locale", "pensiunile din zonă", "locațiile din Turda"],
    photoSpots: ["zonele de deal și munte", "văile din jur", "peisajele naturale"],
    services: ["nunta"],
  },

  // --- Sate și comune lângă Sibiu — doar nuntă ---
  {
    slug: "selimbar",
    name: "Șelimbăr",
    county: "Sibiu",
    description: "comună la marginea Sibiului cu nunți elegante, locații moderne și acces rapid la tot ce oferă Sibiul pentru evenimente",
    intro: "La nunțile din Șelimbăr livrăm acoperire completă, cu un stil curat care se potrivește locațiilor moderne din apropierea Sibiului.",
    nearbyAreas: ["Sibiu", "Cisnădie", "Cristian", "Orlat"],
    venues: ["saloanele moderne din zonă", "locațiile din Sibiu", "restauranturile locale"],
    photoSpots: ["zonele verzi", "câmpul de la Șelimbăr", "vecinătatea Sibiului"],
    services: ["nunta"],
  },
  {
    slug: "cristian-sibiu",
    name: "Cristian",
    county: "Sibiu",
    description: "sat săsesc autentic lângă Sibiu, cu nunți de familie și un cadru rural bine conservat potrivit pentru imagini calde",
    intro: "La nunțile din Cristian valorificăm farmecul satelor săsești din zona Sibiului, cu o documentare discretă și naturală.",
    nearbyAreas: ["Sibiu", "Șelimbăr", "Rășinari", "Orlat"],
    venues: ["saloanele locale", "locațiile din Sibiu", "pensiunile din zonă"],
    photoSpots: ["biserica fortificată", "centrul satului", "peisajele rurale din jur"],
    services: ["nunta"],
  },
  {
    slug: "rusinari",
    name: "Rășinari",
    county: "Sibiu",
    description: "sat tradițional la poalele munților, cu nunți autentice și un decor natural deosebit pentru cadre memorabile",
    intro: "La nunțile din Rășinari cadrul muntos și tradiția locului fac diferența — documentăm cu atenție la specificul autentic al zonei.",
    nearbyAreas: ["Sibiu", "Păltiniș", "Șelimbăr", "Orlat"],
    venues: ["saloanele locale", "locațiile din Sibiu", "pensiunile din munte"],
    photoSpots: ["centrul satului", "Păltiniș", "peisajele montane din jur"],
    services: ["nunta"],
  },
  {
    slug: "ocna-sibiului",
    name: "Ocna Sibiului",
    county: "Sibiu",
    description: "stațiune cu lacuri sărate lângă Sibiu, potrivită pentru nunți cu atmosferă relaxată și cadre naturale neobișnuite",
    intro: "La nunțile din Ocna Sibiului valorificăm lacurile și peisajul aparte al zonei pentru cadre unice, cu o documentare completă.",
    nearbyAreas: ["Sibiu", "Mediaș", "Copșa Mică", "Șelimbăr"],
    venues: ["saloanele din stațiune", "locațiile din Sibiu", "restauranturile locale"],
    photoSpots: ["lacurile sărate", "parcul stațiunii", "zonele verzi din jur"],
    services: ["nunta"],
  },
  {
    slug: "talmaciu",
    name: "Tălmaciu",
    county: "Sibiu",
    description: "comună la intrarea în Defileul Oltului, cu nunți de familie și un cadru natural pitoresc pentru cadre foto memorabile",
    intro: "La nunțile din Tălmaciu documentăm complet ziua și valorificăm peisajul superb de la intrarea în defileu.",
    nearbyAreas: ["Sibiu", "Avrig", "Cisnădie", "Boița"],
    venues: ["saloanele locale", "locațiile din Sibiu", "pensiunile din zonă"],
    photoSpots: ["Defileul Oltului", "Cetatea Tălmaciului", "peisajele din zonă"],
    services: ["nunta"],
  },

  // --- Sate și comune lângă Sebeș și Alba Iulia — doar nuntă ---
  {
    slug: "lancram",
    name: "Lancrăm",
    county: "Alba",
    description: "sat lângă Sebeș cunoscut ca locul natal al lui Lucian Blaga, cu nunți de familie autentice și cadre rurale cu personalitate",
    intro: "La nunțile din Lancrăm documentăm cu atenție la farmecul locului și la momentele de familie care fac ziua memorabilă.",
    nearbyAreas: ["Sebeș", "Alba Iulia", "Petrești", "Săsciori"],
    venues: ["saloanele din Sebeș", "locațiile din Alba Iulia", "pensiunile locale"],
    photoSpots: ["Casa memorială Blaga", "centrul satului", "peisajele rurale"],
    services: ["nunta"],
  },
  {
    slug: "petrestii-de-jos",
    name: "Petrești",
    county: "Alba",
    description: "comună lângă Sebeș cu nunți de familie calde și acces rapid spre locațiile premium din Sebeș și Alba Iulia",
    intro: "La nunțile din Petrești livrăm acoperire completă foto-video, cu același standard ca în Sebeș, fără deplasare suplimentară.",
    nearbyAreas: ["Sebeș", "Lancrăm", "Alba Iulia", "Cugir"],
    venues: ["saloanele din Sebeș", "locațiile din Alba Iulia", "restauranturile locale"],
    photoSpots: ["peisajele rurale", "zonele verzi", "împrejurimile"],
    services: ["nunta"],
  },
  {
    slug: "vintu-de-jos",
    name: "Vințu de Jos",
    county: "Alba",
    description: "comună pe Mureș lângă Alba Iulia, cu nunți de familie și un cadru natural plăcut pentru portrete și cadre video",
    intro: "La nunțile din Vințu de Jos documentăm complet evenimentul, cu atenție la familie și la momentele care fac diferența.",
    nearbyAreas: ["Alba Iulia", "Sebeș", "Teiuș", "Șibot"],
    venues: ["saloanele locale", "locațiile din Alba Iulia", "restauranturile din zonă"],
    photoSpots: ["malul Mureșului", "centrul comunei", "peisajele din vale"],
    services: ["nunta"],
  },
  {
    slug: "teius",
    name: "Teiuș",
    county: "Alba",
    description: "nod feroviar important în Alba, cu nunți de familie și acces rapid spre Cluj, Alba Iulia și Blaj",
    intro: "La nunțile din Teiuș livrăm acoperire foto-video completă, cu un ritm adaptat la eveniment și livrare rapidă.",
    nearbyAreas: ["Alba Iulia", "Blaj", "Aiud", "Vințu de Jos"],
    venues: ["saloanele locale", "locațiile din Alba Iulia", "restauranturile din zonă"],
    photoSpots: ["centrul orașului", "zonele verzi", "împrejurimile"],
    services: ["nunta"],
  },
  {
    slug: "galda-de-jos",
    name: "Galda de Jos",
    county: "Alba",
    description: "comună viticolă între Alba Iulia și Aiud, cu nunți autentice și locații cu specific de zonă viticolă transilvăneană",
    intro: "La nunțile din Galda de Jos valorificăm podgoriile și cadrul natural autentic pentru imagini memorabile.",
    nearbyAreas: ["Alba Iulia", "Aiud", "Teiuș", "Meteș"],
    venues: ["crama Jidvei area", "saloanele locale", "locațiile din Alba Iulia"],
    photoSpots: ["podgoriile din zonă", "peisajele de deal", "centrul comunei"],
    services: ["nunta"],
  },

  // [seo-generator]
  {
    slug: "fotograf-nunta-cluj",
    name: "Cluj-Napoca (extindere zone limitrofe)",
    county: "Cluj",
    description: "Capitala Transilvaniei cu arhitectură eclectică parcuri verzi și peisaje montane spectaculoase",
    intro: "Oferim servicii profesionale de fotografie și videografie în Cluj-Napoca și zonele limitrofe, surprinzând fiecare moment important cu pasiune și creativitate.",
    nearbyAreas: ["Florești","Apahida","Baciu","Gilău"],
    venues: ["Grand Hotel Italia Cluj-Napoca","Sala Polivalentă Cluj-Napoca","Botanica Events","Château Belin"],
    photoSpots: ["Parcul Central Simion Bărnuțiu","Cetățuia Cluj-Napoca","Piața Unirii Cluj-Napoca"],
    services: ["nunta","botez","majorat","evenimente","cununie-civila","logodna","corporate","trash-the-dress","save-the-date"],
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
  {
    slug: "cununie-civila",
    name: "Cununie Civilă",
    accusative: "cununia civilă",
    plural: "cununii civile",
    nameLong: "Fotografie și videografie pentru cununie civilă",
    description:
      "Cununia civilă e un moment scurt dar plin de emoție. Documentăm discret întreaga ceremonie — de la pregătiri, la semnătură, până la prima poză de cuplu.",
    shortPitch: "pentru cupluri care vor imagini curate și emoție autentică la cununia civilă, fără pauze forțate sau cadre artificiale",
  },
  {
    slug: "logodna",
    name: "Logodnă",
    accusative: "logodna",
    plural: "logodne",
    nameLong: "Fotografie și videografie pentru logodnă și inel de cerere",
    description:
      "Surprindem cererea în căsătorie sau ședința de logodnă cu discreție și naturalețe — cadre curate, emoție reală și imagini care spun o poveste.",
    shortPitch: "pentru cupluri care vor să surprindă cererea în căsătorie sau să facă o ședință de logodnă cu cadre autentice",
  },
  {
    slug: "corporate",
    name: "Corporate",
    accusative: "evenimentul corporate",
    plural: "evenimente corporate",
    nameLong: "Fotografie și videografie pentru evenimente corporate",
    description:
      "Acoperim conferințe, team building-uri, lansări de produse și evenimente de business cu un stil profesionist, discret și livrat rapid.",
    shortPitch: "pentru companii care au nevoie de foto-video profesionist la evenimente corporate, conferințe sau activări de brand",
  },
  {
    slug: "inmormantare",
    name: "Înmormântare",
    accusative: "înmormântarea",
    plural: "înmormântări",
    nameLong: "Fotografie și videografie pentru înmormântare și priveghi",
    description:
      "Documentăm cu maximă discreție și respect ceremoniile de înmormântare, pomenire și priveghi — pentru ca familia să păstreze amintiri dincolo de durere.",
    shortPitch: "pentru familii care doresc o documentare discretă și respectuoasă a ceremoniei de înmormântare sau priveghi",
  },
  {
    slug: "trash-the-dress",
    name: "Trash the Dress",
    accusative: "ședința trash the dress",
    plural: "ședințe trash the dress",
    nameLong: "Fotografie Trash the Dress — ședință foto după nuntă",
    description:
      "O ședință foto îndrăzneață cu rochia de mireasă, după nuntă — în apă, în natură sau în locații neconvenționale. Cadre curate, energie autentică.",
    shortPitch: "pentru mirese care vor o ședință foto creativă și neconvențională cu rochia de nuntă, după marele eveniment",
  },
  {
    slug: "save-the-date",
    name: "Save the Date",
    accusative: "ședința save the date",
    plural: "ședințe save the date",
    nameLong: "Fotografie Save the Date — ședință foto înainte de nuntă",
    description:
      "Ședința save the date e prima oară când fotografiem cuplul împreună — relaxat, natural, fără presiunea zilei mari. Cadre pentru invitații și amintiri.",
    shortPitch: "pentru cupluri care vor o ședință foto relaxată înainte de nuntă, pentru save the date sau albumul de cuplu",
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

function allowedServices(city: CityData): ServiceData[] {
  if (!city.services) return SERVICES;
  return SERVICES.filter(s => city.services!.includes(s.slug));
}

export const CANONICAL_LOCATION_ROUTES: LocationRoute[] = CITIES.flatMap(city =>
  allowedServices(city).map(service => ({
    path: PRIMARY_KEYWORDS[0].template(service, city),
    citySlug: city.slug,
    serviceSlug: service.slug,
    canonicalPath: PRIMARY_KEYWORDS[0].template(service, city),
    keywordLabel: PRIMARY_KEYWORDS[0].label,
  }))
);

export const ALL_LOCATION_ROUTES: LocationRoute[] = CITIES.flatMap(city =>
  allowedServices(city).flatMap(service => {
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
