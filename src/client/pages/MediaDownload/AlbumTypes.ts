export interface Album {
  slug: string;
  title: string;
  featured: string[];
  photos: string[];
  originalPhoto: string[];
  shortvideo?: string | null;
  longvideo?: string | null;
}
