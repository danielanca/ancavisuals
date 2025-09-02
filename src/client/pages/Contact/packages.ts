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
