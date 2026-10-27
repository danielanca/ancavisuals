import React, { useEffect, useState } from "react";
import CampaignLandingPage, { type CampaignPage } from "../CampaignLanding/CampaignLandingPage";
import SectionSkeleton from "../CampaignLanding/SectionSkeleton";
import { offerToCampaign, type Offer } from "../OfertaPage";
import { stableVh } from "../../utils/stableViewport";

// Under the guide (owner, 2026-10-27): the /oferta/olx hero, portfolio and configurator — nothing else.
const OFFER_SLUG = "olx";

/** Same sources as OfertaPage, offer first: "olx" is an offer, so the campaign lookup would only 404. */
async function loadOffer(): Promise<CampaignPage | null> {
  const offer = await fetch(`/api/oferte/${OFFER_SLUG}`);
  if (offer.ok) return offerToCampaign(await offer.json() as Offer);
  const campaign = await fetch(`/api/campaign/public/${OFFER_SLUG}`);
  return campaign.ok ? await campaign.json() as CampaignPage : null;
}

export default function GuideOfferPreview() {
  const [page, setPage] = useState<CampaignPage | null | undefined>(undefined);
  useEffect(() => {
    loadOffer().then(setPage).catch(() => setPage(null));
  }, []);
  if (page === undefined) return <SectionSkeleton height={stableVh(85)} />;
  // No offer to show: the guide page simply ends with the download.
  if (!page) return null;
  return <CampaignLandingPage page={page} variant="preview" />;
}
