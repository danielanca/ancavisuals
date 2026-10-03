import loadable from "@loadable/component";

// Below-the-fold parts of the landing, each in its own JS chunk. They download in
// small groups as the visitor scrolls (LOAD_GROUPS), not with the page: the hero,
// texts and configurator come with the first HTML, everything else follows.
// `ssr: false` — they sit inside LazySection, which renders a placeholder on the server anyway.
export const PortfolioParallaxGallery = loadable(() => import("../Portfolio/PortfolioParallaxGallery"), { ssr: false });
export const CampaignVideoPlayer = loadable(() => import("./CampaignVideoPlayer"), { ssr: false });
export const AncaVisualsPromo = loadable(() => import("../MediaDownload/AncaVisualsPromo"), { ssr: false });
export const CampaignPackages = loadable(() => import("./CampaignPackages"), { ssr: false });
export const GuideBook = loadable(() => import("./GuideBook"), { ssr: false });

type Preloadable = { preload: () => void };

/** 2–3 parts per group, in page order. Group 0 starts once the page is up; each later group when the one before comes into view. */
export const LOAD_GROUPS: Preloadable[][] = [
  [PortfolioParallaxGallery, CampaignVideoPlayer],
  [AncaVisualsPromo, CampaignPackages, GuideBook],
];

export const preloadGroup = (index: number) => LOAD_GROUPS[index]?.forEach((part) => part.preload());
