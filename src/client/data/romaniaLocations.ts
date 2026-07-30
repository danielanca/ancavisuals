// Județele României (nume oficiale, cu diacritice) și principalele orașe din fiecare județ.
// Orașul rămâne editabil liber (localitățile mici/comunele nu sunt incluse), dar e sugerat dintr-o listă.

export const ROMANIAN_COUNTIES: string[] = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
  "Brăila", "Brașov", "București", "Buzău", "Caraș-Severin", "Călărași",
  "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu",
  "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș",
  "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Sălaj", "Satu Mare",
  "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vaslui", "Vâlcea",
  "Vrancea",
];

// Cheile corespund numelor de mai sus, dar fără diacritice (necesar pentru lookup-ul de mai jos).
const CITIES_BY_COUNTY: Record<string, string[]> = {
  "Alba": ["Abrud", "Aiud", "Alba Iulia", "Baia de Arieș", "Blaj", "Câmpeni", "Cugir", "Ocna Mureș", "Sebeș", "Teiuș", "Zlatna"],
  "Arad": ["Arad", "Chișineu-Criș", "Curtici", "Ineu", "Lipova", "Nădlac", "Pâncota", "Pecica", "Sântana", "Sebiș"],
  "Argeș": ["Câmpulung", "Costești", "Curtea de Argeș", "Mioveni", "Pitești", "Ștefănești", "Topoloveni"],
  "Bacău": ["Bacău", "Buhuși", "Comănești", "Dărmănești", "Moinești", "Onești", "Slănic Moldova", "Târgu Ocna"],
  "Bihor": ["Aleșd", "Beiuș", "Marghita", "Nucet", "Oradea", "Săcueni", "Salonta", "Ștei", "Valea lui Mihai", "Vașcău"],
  "Bistrița-Năsăud": ["Beclean", "Bistrița", "Năsăud", "Sângeorz-Băi"],
  "Botoșani": ["Botoșani", "Bucecea", "Darabani", "Dorohoi", "Flămânzi", "Săveni", "Ștefănești"],
  "Brăila": ["Brăila", "Făurei", "Ianca", "Însurăței"],
  "Brașov": ["Brașov", "Codlea", "Făgăraș", "Ghimbav", "Predeal", "Râșnov", "Rupea", "Săcele", "Victoria", "Zărnești"],
  "București": ["București"],
  "Buzău": ["Buzău", "Nehoiu", "Pătârlagele", "Pogoanele", "Râmnicu Sărat"],
  "Caraș-Severin": ["Anina", "Băile Herculane", "Bocșa", "Caransebeș", "Moldova Nouă", "Oravița", "Oțelu Roșu", "Reșița"],
  "Călărași": ["Budești", "Călărași", "Fundulea", "Lehliu Gară", "Oltenița"],
  "Cluj": ["Câmpia Turzii", "Cluj-Napoca", "Dej", "Gherla", "Huedin", "Turda"],
  "Constanța": ["Băneasa", "Cernavodă", "Constanța", "Eforie", "Hârșova", "Mangalia", "Medgidia", "Murfatlar", "Năvodari", "Negru Vodă", "Ovidiu", "Techirghiol"],
  "Covasna": ["Baraolt", "Covasna", "Întorsura Buzăului", "Sfântu Gheorghe", "Târgu Secuiesc"],
  "Dâmbovița": ["Fieni", "Găești", "Moreni", "Pucioasa", "Racari", "Târgoviște", "Titu"],
  "Dolj": ["Băilești", "Bechet", "Calafat", "Craiova", "Dăbuleni", "Filiași", "Segarcea"],
  "Galați": ["Berești", "Galați", "Târgu Bujor", "Tecuci"],
  "Giurgiu": ["Bolintin-Vale", "Giurgiu", "Mihăilești"],
  "Gorj": ["Bumbești-Jiu", "Motru", "Novaci", "Rovinari", "Târgu Cărbunești", "Târgu Jiu", "Țicleni", "Tismana", "Turceni"],
  "Harghita": ["Băile Tușnad", "Bălan", "Borsec", "Cristuru Secuiesc", "Gheorgheni", "Miercurea Ciuc", "Odorheiu Secuiesc", "Toplița", "Vlăhița"],
  "Hunedoara": ["Aninoasa", "Brad", "Călan", "Deva", "Geoagiu", "Hațeg", "Hunedoara", "Lupeni", "Orăștie", "Petrila", "Petroșani", "Simeria", "Uricani", "Vulcan"],
  "Ialomița": ["Amara", "Căzănești", "Fetești", "Fierbinți-Târg", "Slobozia", "Țăndărei", "Urziceni"],
  "Iași": ["Hârlău", "Iași", "Pașcani", "Podu Iloaiei", "Târgu Frumos"],
  "Ilfov": ["Bragadiru", "Buftea", "Chitila", "Măgurele", "Otopeni", "Pantelimon", "Popești-Leordeni", "Voluntari"],
  "Maramureș": ["Baia Mare", "Baia Sprie", "Borșa", "Cavnic", "Dragomirești", "Săliștea de Sus", "Seini", "Sighetu Marmației", "Șomcuta Mare", "Târgu Lăpuș", "Tăuții-Măgherăuș", "Ulmeni", "Vișeu de Sus"],
  "Mehedinți": ["Baia de Aramă", "Drobeta-Turnu Severin", "Orșova", "Strehaia", "Vânju Mare"],
  "Mureș": ["Iernut", "Luduș", "Miercurea Nirajului", "Reghin", "Sângeorgiu de Pădure", "Sărmașu", "Sighișoara", "Sovata", "Târgu Mureș", "Târnăveni", "Ungheni"],
  "Neamț": ["Bicaz", "Piatra Neamț", "Roman", "Roznov", "Târgu Neamț"],
  "Olt": ["Balș", "Caracal", "Corabia", "Drăgănești-Olt", "Piatra-Olt", "Potcoava", "Scornicești", "Slatina"],
  "Prahova": ["Azuga", "Băicoi", "Boldești-Scăeni", "Breaza", "Bușteni", "Câmpina", "Comarnic", "Mizil", "Ploiești", "Plopeni", "Sinaia", "Slănic", "Urlați", "Vălenii de Munte"],
  "Sălaj": ["Cehu Silvaniei", "Jibou", "Șimleu Silvaniei", "Zalău"],
  "Satu Mare": ["Ardud", "Carei", "Livada", "Negrești-Oaș", "Satu Mare", "Tășnad"],
  "Sibiu": ["Agnita", "Avrig", "Cisnădie", "Copșa Mică", "Dumbrăveni", "Mediaș", "Miercurea Sibiului", "Ocna Sibiului", "Săliște", "Sibiu", "Tălmaciu"],
  "Suceava": ["Broșteni", "Cajvana", "Câmpulung Moldovenesc", "Dolhasca", "Fălticeni", "Frasin", "Gura Humorului", "Liteni", "Milișăuți", "Rădăuți", "Salcea", "Siret", "Solca", "Suceava", "Vatra Dornei", "Vicovu de Sus"],
  "Teleorman": ["Alexandria", "Roșiorii de Vede", "Turnu Măgurele", "Videle", "Zimnicea"],
  "Timiș": ["Buziaș", "Ciacova", "Deta", "Făget", "Gătaia", "Jimbolia", "Lugoj", "Recaș", "Sânnicolau Mare", "Timișoara"],
  "Tulcea": ["Babadag", "Isaccea", "Măcin", "Sulina", "Tulcea"],
  "Vaslui": ["Bârlad", "Huși", "Murgeni", "Negrești", "Vaslui"],
  "Vâlcea": ["Băbeni", "Băile Govora", "Băile Olănești", "Bălcești", "Berbești", "Brezoi", "Călimănești", "Drăgășani", "Horezu", "Ocnele Mari", "Râmnicu Vâlcea"],
  "Vrancea": ["Adjud", "Focșani", "Mărășești", "Odobești", "Panciu"],
};

export function getCitiesForCounty(county: string): string[] {
  return CITIES_BY_COUNTY[county] ?? [];
}
