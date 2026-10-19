/*
 * Purpose: ready-made "Noutăți album" messages so the admin only picks a template and fills in
 * a date / a number of days — clients learn the status of their photos, video and printed
 * album automatically instead of asking on WhatsApp.
 */
import { formatEstimateDate, type AlbumUpdateKind } from "./albumUpdates";

export const DELIVERABLES = {
  photos: { label: "Pozele", plural: true },
  video: { label: "Videoclipul", plural: false },
  photosVideo: { label: "Pozele și videoclipul", plural: true },
  album: { label: "Albumul tipărit", plural: false },
} as const;
export type Deliverable = keyof typeof DELIVERABLES;

export type TemplateParams = {
  deliverable: Deliverable;
  /** ISO YYYY-MM-DD */
  date?: string;
  delayDays?: number;
  photoCount?: number;
};

export type AlbumUpdateTemplate = {
  id: string;
  title: string;
  kind: AlbumUpdateKind;
  /** Which inputs the composer shows. */
  needs: { deliverable?: boolean; date?: "required" | "optional"; delayDays?: boolean; photoCount?: boolean };
  build: (p: TemplateParams) => string;
};

export const FOLLOW_PROGRESS = "Dacă vrei să urmărești progresul, poți face asta oricând din linkul albumului.";

const words = (deliverable: Deliverable) => {
  const d = DELIVERABLES[deliverable];
  return {
    label: d.label,
    lower: d.label.charAt(0).toLowerCase() + d.label.slice(1),
    is: d.plural ? "sunt" : "este",
    ready: d.plural ? "sunt gata" : "este gata",
    them: d.plural ? "Le" : "Îl",
  };
};

const onDate = (date?: string) => (date ? formatEstimateDate(date) : "");

export const ALBUM_UPDATE_TEMPLATES: AlbumUpdateTemplate[] = [
  {
    id: "estimate",
    title: "📅 Estimare de predare",
    kind: "estimate",
    needs: { deliverable: true, date: "required" },
    build: (p) => {
      const w = words(p.deliverable);
      return `${w.label} ${w.is} în lucru. Estimăm că ${w.ready} în jurul datei de ${onDate(p.date)}. ${FOLLOW_PROGRESS}`;
    },
  },
  {
    id: "delay-volume",
    title: "⏳ Întârziere — multe evenimente",
    kind: "delay",
    needs: { deliverable: true, date: "optional", delayDays: true },
    build: (p) => {
      const w = words(p.deliverable);
      const extra = p.delayDays && p.delayDays > 0 ? `, cu aproximativ ${p.delayDays} ${p.delayDays === 1 ? "zi" : "zile"} mai mult decât estimam` : "";
      const newDate = p.date ? ` Noua estimare: ${onDate(p.date)}.` : "";
      return `Ne cerem scuze: din cauza numărului mare de evenimente din această perioadă, procesarea pentru ${w.lower} durează puțin mai mult${extra}.${newDate} Lucrăm cu aceeași atenție la fiecare detaliu. ${FOLLOW_PROGRESS}`;
    },
  },
  {
    id: "in-progress",
    title: "🎬 Am început editarea",
    kind: "announcement",
    needs: { deliverable: true, date: "optional" },
    build: (p) => {
      const w = words(p.deliverable);
      const eta = p.date ? ` Estimăm că ${w.ready} în jurul datei de ${onDate(p.date)}.` : "";
      return `Am început editarea: ${w.lower} ${w.is} acum în lucru.${eta} ${FOLLOW_PROGRESS}`;
    },
  },
  {
    id: "new-photos",
    title: "📸 Poze noi încărcate",
    kind: "photos",
    needs: { photoCount: true },
    build: (p) => {
      const count = p.photoCount && p.photoCount > 0 ? `${p.photoCount} ` : "";
      return `Am încărcat ${count}poze noi în album. Le poți vedea și descărca chiar acum.`;
    },
  },
  {
    id: "ready",
    title: "✅ Gata de descărcare",
    kind: "photos",
    needs: { deliverable: true },
    build: (p) => {
      const w = words(p.deliverable);
      return `${w.label} ${w.ready}! ${w.them} găsești în album, la calitate completă. Te rugăm să ${w.them.toLowerCase()} salvezi în cel puțin două locuri (ex. calculator + Google Photos / iCloud).`;
    },
  },
  {
    id: "album-print",
    title: "🖨️ Albumul a intrat la tipar",
    kind: "announcement",
    needs: { date: "optional" },
    build: (p) => {
      const eta = p.date ? ` Estimăm livrarea în jurul datei de ${onDate(p.date)}, la adresa completată în album.` : "";
      return `Albumul tipărit a intrat la tipar.${eta} ${FOLLOW_PROGRESS}`;
    },
  },
  {
    id: "album-shipped",
    title: "🚚 Albumul a fost expediat",
    kind: "announcement",
    needs: {},
    build: () => "Albumul tipărit a fost expediat la adresa de livrare completată în album. Ar trebui să ajungă în 1–3 zile lucrătoare.",
  },
];

export function findAlbumUpdateTemplate(id: string): AlbumUpdateTemplate | undefined {
  return ALBUM_UPDATE_TEMPLATES.find((t) => t.id === id);
}
