import React from "react";
import { useLocation } from "react-router-dom";
import { ALL_LOCATION_ROUTES } from "./locationData";
import { LocationPageWrapper } from "./LocationPage";
import NotFoundPage from "../NotFoundPage";

// The city pages (/foto-video-nunta-cluj …) as one route: this module — and the city
// content behind it — loads only when such a page is opened (ssrLazy in App.tsx).
// Any other unknown path gets the 404 page, as before.
const ROUTE_BY_PATH = new Map(ALL_LOCATION_ROUTES.map((route) => [route.path.toLowerCase(), route]));

export default function LocationRoute() {
  const { pathname } = useLocation();
  const route = ROUTE_BY_PATH.get(pathname.replace(/\/+$/, "").toLowerCase());
  if (!route) return <NotFoundPage />;
  const { path, citySlug, serviceSlug, canonicalPath, keywordLabel } = route;
  // A new key per page: moving between two city pages starts the page fresh.
  return <LocationPageWrapper key={path} citySlug={citySlug} serviceSlug={serviceSlug} canonicalPath={canonicalPath} keywordLabel={keywordLabel} />;
}
