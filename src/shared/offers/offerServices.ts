import pricesData from "../pricing/prices.json" assert { type: "json" };

export type OfferServiceDefinition = {
  id: string;
  label: string;
  description: string;
  basePrice: string;
  sampleImages: string[];
};

export type OfferAssetKind = "image" | "video";

export type OfferMediaAsset = {
  id: string;
  serviceId: string;
  kind: OfferAssetKind;
  url: string;
  bunnyPath?: string;
  label: string;
  createdAt?: string;
  sourceAlbumSlug?: string;
  sourceProposalId?: string;
};

export type OfferTemplateAsset = {
  assetId: string;
  order: number;
};

void pricesData;

function formatPrice(id: string): string {
  if (id === "qrmoments") return "Inclus gratuit";
  return "Pret configurat in oferta";
}

export const OFFER_SERVICES: OfferServiceDefinition[] = [
  {
    id: "photo",
    label: "Fotografie",
    description: "Cadre documentare si portrete curate, cu focus pe emotie si atmosfera.",
    basePrice: formatPrice("photo"),
    sampleImages: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FPoze-125.jpg?alt=media&token=364b1285-b470-4251-8002-8ba6a7a1bb98",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FClaudiu-016.jpg?alt=media&token=151a9324-2424-476b-8163-9b6610611f12",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-218mm.jpg?alt=media&token=08420520-11dc-4d9e-86eb-8ee371d4bd37",
    ],
  },
  {
    id: "video",
    label: "Videografie",
    description: "Highlight-uri si filmari cinematice pentru ritm, energie si storytelling.",
    basePrice: formatPrice("video"),
    sampleImages: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FVideo_Daniel_Ana_instagram.mp4.jpg?alt=media&token=359882e0-7e12-4925-bb31-bcb5978fa59a",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FClaudiu%20Scurt.jpg?alt=media&token=02cc0535-5268-43fb-8a6c-63ede75b2c6f",
      "https://img.youtube.com/vi/sA8VXDYePwA/maxresdefault.jpg",
    ],
  },
  {
    id: "album",
    label: "Album foto 10x15 100 poze",
    description: "Selectii pregatite pentru print, layout si prezentare premium.",
    basePrice: formatPrice("album"),
    sampleImages: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FAndradaAnca%2FPoze-2315.jpg?alt=media&token=2966ffae-cd87-436c-aa24-b8b764185ae7",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Feggsparty%2Fmulaje-20.jpg?alt=media&token=5781c4d2-3d9e-4402-a197-fc00480ecf68",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Feggsparty%2Fchristmas-162.jpg?alt=media&token=1c90c7ad-b718-499a-be91-03d888519b16",
    ],
  },
  {
    id: "photobooth",
    label: "Fotocabina",
    description: "Cadre rapide si distractive pentru invitati, usor de pastrat si share-uit.",
    basePrice: formatPrice("photobooth"),
    sampleImages: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fvideobooth%2Ffotocabina.webp?alt=media&token=5a23fd34-3dba-4823-8e8e-56902c8224cf",
    ],
  },
  {
    id: "videobooth",
    label: "Videocabina 360",
    description: "Clipuri scurte, dinamice, pentru un moment memorabil si viralizabil.",
    basePrice: formatPrice("videobooth"),
    sampleImages: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fvideobooth%2Fvidoebooth.avif?alt=media&token=ab8a3f18-cac8-460c-a253-5d89a6b8a5f1",
    ],
  },
  {
    id: "qrmoments",
    label: "QR Moments",
    description: "Invitatii incarca instant poze si video direct de pe telefon, fara aplicatie.",
    basePrice: formatPrice("qrmoments"),
    sampleImages: [
      "https://images.pexels.com/photos/15591485/pexels-photo-15591485/free-photo-of-smiling-women-in-dresses-on-party.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FPoze-125.jpg?alt=media&token=364b1285-b470-4251-8002-8ba6a7a1bb98",
    ],
  },
];

const OFFER_SERVICE_IDS = new Set(OFFER_SERVICES.map(service => service.id));

export type OfferShowcaseService = OfferServiceDefinition & {
  assets: Array<{
    id: string;
    kind: OfferAssetKind;
    url: string;
    label: string;
  }>;
};

export function normalizeOfferServiceIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map(value => String(value).trim())
        .filter(value => OFFER_SERVICE_IDS.has(value)),
    ),
  );
}

export function normalizeShowcaseImages(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(value => String(value).trim())
    .filter(Boolean);
}

export function normalizeOfferTemplateAssets(input: unknown): OfferTemplateAsset[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value, index) => {
      if (!value || typeof value !== "object") return null;
      const record = value as Record<string, unknown>;
      const assetId = typeof record.assetId === "string" ? record.assetId.trim() : "";
      if (!assetId) return null;
      return {
        assetId,
        order: typeof record.order === "number" ? record.order : index,
      };
    })
    .filter((value): value is OfferTemplateAsset => value !== null)
    .sort((a, b) => a.order - b.order)
    .map((value, index) => ({ ...value, order: index }));
}

export function mergeOfferShowcase(
  raw: unknown,
  resolvedAssets?: Record<string, OfferMediaAsset[]>,
): OfferShowcaseService[] {
  const showcaseMap = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return OFFER_SERVICES.map(service => {
    const entry = showcaseMap[service.id];
    const assets = resolvedAssets?.[service.id] ?? [];
    const fallbackImages = entry && typeof entry === "object" && "images" in (entry as Record<string, unknown>)
      ? normalizeShowcaseImages((entry as { images?: unknown }).images).map((url, index) => ({
          id: `${service.id}-fallback-${index}`,
          kind: "image" as const,
          url,
          label: service.label,
        }))
      : service.sampleImages.map((url, index) => ({
          id: `${service.id}-sample-${index}`,
          kind: "image" as const,
          url,
          label: service.label,
        }));

    return {
      ...service,
      assets: assets.length > 0
        ? assets.map(asset => ({ id: asset.id, kind: asset.kind, url: asset.url, label: asset.label }))
        : fallbackImages,
    };
  });
}
