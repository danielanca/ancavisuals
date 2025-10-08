export type PackageOption = {
  key: string;
  label: string;
  description?: string;
  price: number;
};

export const PACKAGES: PackageOption[] = [
  {
    key: 'basic',
    label: 'Basic',
    description: 'Doar fotografie – 1500 RON',
    price: 1500,
  },
  {
    key: 'standard',
    label: 'Standard',
    description: 'Foto + video – 2800 RON',
    price: 2800,
  },
  {
    key: 'premium',
    label: 'Premium',
    description: 'Foto + video + dronă – 3300 RON',
    price: 3300,
  },
];

export type Pkg = {
  id: string;
  title: string;
  price: number; // RON
  note?: string; // text pentru dropdown
  recommended?: boolean; // badge
};

export const PACKAGES_NEW: Pkg[] = [
  { id: 'photo', title: 'Fotografie', price: 1500, note: 'Acoperire completă; 500–800 fotografii editate.' },
  { id: 'video', title: 'Videografie', price: 1300, note: 'Filmări 4K; highlight 3–5 min + clip lung.' },
  { id: 'album', title: 'Album 15×10 cm', price: 400, note: '100 poze, hârtie foto premium.' },
  { id: 'second', title: 'Al doilea fotograf', price: 600, note: 'Acoperire simultană pregătiri + sală.' },
  { id: 'express', title: 'Predare Express (7 zile)', price: 300, note: 'Livrare prioritară.', recommended: true },
];
export const CUSTOM_OPTIONS: PackageOption[] = [
  {
    key: 'photo',
    label: 'Fotograf',
    description: 'Include încă un videograf cadou!',
    price: 1500,
  },
  {
    key: 'video',
    label: 'Videograf',
    description: 'Include încă un fotograf cadou!',
    price: 1800,
  },
];
