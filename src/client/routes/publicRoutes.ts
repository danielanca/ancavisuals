import loadable from "@loadable/component";

const Mainpage = loadable(() => import("../pages/Homepage/Mainpage"), { ssr: true });
const Aboutme = loadable(() => import("../pages/About/Aboutme"), { ssr: true });
const Portfolio = loadable(() => import("../pages/Portfolio/Portfolio"), { ssr: true });
const Contact = loadable(() => import("../pages/Contact/Contacts"), { ssr: true });
const MediaAlbumPage = loadable(() => import("../pages/MediaDownload/MediaAlbumPage"), { ssr: true });
const SharePage = loadable(() => import("../pages/MediaDownload/SharePage"), { ssr: true });
const GuestVerificationPage = loadable(() => import("../pages/GuestVerification/GuestVerification"), { ssr: true });
const InvitationLanding = loadable(() => import("../pages/InvitationLanding/InvitationLanding"), { ssr: true });
const QRMomentsPage = loadable(() => import("../pages/QRMoments/QRMoments"), { ssr: true });
const BioPage =  loadable(() => import("../pages/Bio/Bio"), { ssr: true });
const AddressListWrapper = loadable( () => import("../pages/DeliveryAddress/AddressListWrapper"),{ ssr: false });

import { publicRoutesType } from "./types";

const publicRoutes: publicRoutesType[] = [
  {
    path: "",
    layout: null,
    component: Mainpage,
  },
  {
    path: "/despre",
    layout: null,
    component: Aboutme,
  },
  {
    path: "/portofoliu",
    layout: null,
    component: Portfolio,
  },
  {
    path: "/contact",
    layout: null,
    component: Contact,
  },
  {
    path: "/oferta",
    layout: null,
    component: Contact,
  },
  {
    path: "/media/:slug",
    layout: null,
    component: MediaAlbumPage,
  },
  {
    path: "/share/:id",
    layout: null,
    component: SharePage,
  },
  {
    path: "/invitatie/:slug",
    layout: null,
    component: GuestVerificationPage,
  },
  {
    path: "/invitatie/:slug/invitation",
    layout: null,
    component: InvitationLanding,      // ← Your existing invitation component
  },
  {
    path: "/qr-moments/:eventDate",
    layout: null,
    component: QRMomentsPage,
  },
  {
    path: "/bio",
    layout: null,
    component: BioPage,
  },
  {
  path: "/delivery-address/:slug",
    layout:null,
    component:AddressListWrapper
  }
];

export default publicRoutes;
