export type PackageOption = {
  key: string;
  label: string;
  description?: string;
  price: number;
};

export const PACKAGES: PackageOption[] = [
  { key: "basic", label: "Basic", description: "Doar fotografie – 1500 RON", price: 1500 },
  { key: "standard", label: "Standard", description: "Foto + video – 2800 RON", price: 2800 },
  { key: "premium", label: "Premium", description: "Foto + video + dronă – 3300 RON", price: 3300 },
];

export type Pkg = {
  id: string;
  title: string;
  price: number;
  note?: string;
  recommended?: boolean;
  type?: "photo" | "video";
  samples?: string[]; // new: slider images
};

export const PACKAGES_NEW: Pkg[] = [
  {
    id: "photo",
    title: "Fotografie",
    price: 2500,
    type: "photo",
    note: "Acoperire completă; 500 - 800 fotografii editate.",
    samples: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FPoze-125.jpg?alt=media&token=364b1285-b470-4251-8002-8ba6a7a1bb98",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FClaudiu-016.jpg?alt=media&token=151a9324-2424-476b-8163-9b6610611f12",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fhomepage%2FLAST_EVENTS%2FVertical-218mm.jpg?alt=media&token=08420520-11dc-4d9e-86eb-8ee371d4bd37",
    ],
  },
  {
    id: "video",
    title: "Videografie",
    price: 1500,
    type: "video",
    note: "Filmări 4K; highlight 3–5 min + clip lung. (3-7 ore)",
    samples: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fvideos%2FFaraPOVText.mp4?alt=media&token=b6ea3ef1-13a1-4617-b246-f10a47d9b8e8",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2FBucurestiNunta.mp4?alt=media&token=74d6a5b5-0906-45e1-950c-9632bba7889b",
      "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    ],
  },
  {
    id: "album",
    title: "Album 15×10 cm",
    price: 200,
    type: "photo",
    note: "100 poze, hârtie foto premium.",
    samples: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2FAndradaAnca%2FPoze-2315.jpg?alt=media&token=2966ffae-cd87-436c-aa24-b8b764185ae7",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Feggsparty%2Fmulaje-20.jpg?alt=media&token=5781c4d2-3d9e-4402-a197-fc00480ecf68",
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Feggsparty%2Fchristmas-162.jpg?alt=media&token=1c90c7ad-b718-499a-be91-03d888519b16",
    ],
  },
  {
    id: "photobooth",
    title: "Fotocabina / Photo Booth",
    price: 1200,
    type: "photo",
    note: "Foto cabina pe perioada evenimentului.",
    samples: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fvideobooth%2Ffotocabina.webp?alt=media&token=5a23fd34-3dba-4823-8e8e-56902c8224cf",
    ],
  },
  {
    id: "videobooth",
    title: "Video Cabina 360 / VideoBooth 360",
    price: 1200,
    type: "photo",
    note: "Video cabina pe perioada evenimentului.",
    recommended: true,
    samples: [
      "https://firebasestorage.googleapis.com/v0/b/joculdetectivului.appspot.com/o/ancavisuals%2Fmedia%2Fvideobooth%2Fvidoebooth.avif?alt=media&token=ab8a3f18-cac8-460c-a253-5d89a6b8a5f1",
    ],
  },
];
