export interface AlbumRetention {
  eventDate: string;
  expiresAt: string;
  remainingMs: number;
  isExpired: boolean;
}

export interface Album {
  slug: string;
  title: string;
  featured: string[];
  photos: string[];
  originalPhoto: string[];
  shortvideo?: string | null;
  longvideo?: string | null;
  retention?: AlbumRetention | null;
  zipReady?: boolean;
}
