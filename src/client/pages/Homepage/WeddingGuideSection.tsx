import React from "react";
import GuideBook from "../CampaignLanding/GuideBook";
import WeddingGuideLeadMagnet from "../CampaignLanding/WeddingGuideLeadMagnet";

export default function WeddingGuideSection() {
  return <WeddingGuideLeadMagnet book={<GuideBook />} pagePath="/" />;
}
