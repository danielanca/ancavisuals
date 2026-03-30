export type ServiceType = "nunta" | "botez" | "majorat";

export interface CityData {
  slug: string;
  name: string;
  county: string;
  description: string; // unique phrase about the city for content
}

export interface ServiceData {
  slug: ServiceType;
  name: string;
  nameLong: string;
  description: string;
}

export const CITIES: CityData[] = [
  {
    slug: "sibiu",
    name: "Sibiu",
    county: "Sibiu",
    description: "un oraș cu o arhitectură medievală de poveste și o atmosferă unică în inima Transilvaniei",
  },
  {
    slug: "cluj",
    name: "Cluj-Napoca",
    county: "Cluj",
    description: "cel mai dinamic oraș din Transilvania, plin de energie și locuri spectaculoase pentru fotografii",
  },
  {
    slug: "alba-iulia",
    name: "Alba Iulia",
    county: "Alba",
    description: "orașul cetăților și al istoriei, cu locuri emblematice perfecte pentru amintiri de neuitat",
  },
  {
    slug: "turda",
    name: "Turda",
    county: "Cluj",
    description: "un oraș cu peisaje impresionante, aproape de renumita Cheie a Turzii",
  },
  {
    slug: "arad",
    name: "Arad",
    county: "Arad",
    description: "un oraș elegant cu o arhitectură austro-ungară remarcabilă și sălile de evenimente dintre cele mai frumoase din vest",
  },
  {
    slug: "brasov",
    name: "Brașov",
    county: "Brașov",
    description: "unul dintre cele mai frumoase orașe din România, cu Centrul Vechi și Munții Bucegi ca fundal perfect",
  },
  {
    slug: "targu-mures",
    name: "Târgu Mureș",
    county: "Mureș",
    description: "un oraș cu o bogată cultură și săli de evenimente elegante în inima Transilvaniei",
  },
  {
    slug: "ludus",
    name: "Luduș",
    county: "Mureș",
    description: "un oraș din câmpia Transilvaniei, cu o comunitate caldă și evenimente de familie memorabile",
  },
  {
    slug: "campia-turzii",
    name: "Câmpia Turzii",
    county: "Cluj",
    description: "un oraș în continuă dezvoltare, cu o comunitate unită și evenimente deosebite",
  },
  {
    slug: "oradea",
    name: "Oradea",
    county: "Bihor",
    description: "cel mai frumos oraș Art Nouveau din România, cu o arhitectură spectaculoasă ca decor natural",
  },
];

export const SERVICES: ServiceData[] = [
  {
    slug: "nunta",
    name: "Nuntă",
    nameLong: "Fotografie și Videografie Nuntă",
    description:
      "Ziua nunții este cea mai importantă zi din viața voastră. Captăm fiecare privire, fiecare emoție și fiecare moment spontan — de la pregătiri până la ultima melodie.",
  },
  {
    slug: "botez",
    name: "Botez",
    nameLong: "Fotografie și Videografie Botez",
    description:
      "Botezul este prima mare sărbătoare din viața copilului vostru. Imortalizăm primele zâmbete, emoțiile părinților și bucuria familiei reunite.",
  },
  {
    slug: "majorat",
    name: "Majorat",
    nameLong: "Fotografie și Videografie Majorat",
    description:
      "18 ani se sărbătoresc o singură dată. Captăm energia, distracția și momentele autentice care vor fi povestite ani de zile de aici înainte.",
  },
];

export function getCityBySlug(slug: string): CityData | undefined {
  return CITIES.find(c => c.slug === slug);
}

export function getServiceBySlug(slug: string): ServiceData | undefined {
  return SERVICES.find(s => s.slug === slug);
}

// All 30 combinations for route generation
export const ALL_LOCATION_ROUTES = CITIES.flatMap(city =>
  SERVICES.map(service => ({
    path: `/fotograf-${service.slug}-${city.slug}`,
    citySlug: city.slug,
    serviceSlug: service.slug,
  }))
);
