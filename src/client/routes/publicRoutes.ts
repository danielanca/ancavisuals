import loadable from "@loadable/component";
import React from "react";
import { ALL_LOCATION_ROUTES } from "../pages/LocationSEO/locationData";
import { LocationPageWrapper } from "../pages/LocationSEO/LocationPage";

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
const CopyrightPage = loadable(() => import("../pages/Copyright/Copyright"), { ssr: true });
const PrivacyPage = loadable(() => import("../pages/Privacy/Privacy"), { ssr: true });
const TermsPage = loadable(() => import("../pages/Terms/Terms"), { ssr: true });
const AddressListWrapper = loadable( () => import("../pages/DeliveryAddress/AddressListWrapper"),{ ssr: false });

import { publicRoutesType } from "./types";

const publicRoutes: publicRoutesType[] = [

  /** ============================================================
   *  PAGINI PUBLICE — site principal
   *  Homepage, despre, portofoliu, contact, legal
   * ============================================================ */
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
    path: "/bio",
    layout: null,
    component: BioPage,
  },
  {
    path: "/privacy",
    layout: null,
    component: PrivacyPage,
  },
  {
    path: "/terms",
    layout: null,
    component: TermsPage,
  },
  {
    path: "/copyright",
    layout: null,
    component: CopyrightPage,
  },

  /** ============================================================
   *  CLIENȚI & EVENIMENTE — rute cu parametri dinamici
   *  Albume media, invitații, QR moments, livrare
   * ============================================================ */
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
    component: InvitationLanding,
  },
  {
    path: "/qr-moments/:eventDate",
    layout: null,
    component: QRMomentsPage,
  },
  {
    path: "/delivery-address/:slug",
    layout: null,
    component: AddressListWrapper,
  },

  /** ============================================================
   *  ADMIN — rute semi-publice (autentificate în App.tsx via RequireAuth)
   *  Contact admin booking
   * ============================================================ */

  /** ============================================================
   *  SEO — pagini generate automat
   *  ~30 combinații oraș × serviciu (fotograf/videograf + oraș)
   * ============================================================ */
  ...ALL_LOCATION_ROUTES.map(({ path, citySlug, serviceSlug }) => {
    const Component: React.FC = () =>
      React.createElement(LocationPageWrapper, { citySlug, serviceSlug });
    Component.displayName = `LocationPage_${serviceSlug}_${citySlug}`;
    return { path, layout: null, component: Component };
  }),

];

export default publicRoutes;
