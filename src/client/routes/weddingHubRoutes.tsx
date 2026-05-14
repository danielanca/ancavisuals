import React from "react";
import { Route } from "react-router-dom";
import loadable from "@loadable/component";
import AncaLoader from "../components/UI/AncaLoader";
import WeddingHubAuthWrapper from "../features/wedding-hub/WeddingHubAuthWrapper";
import RequireWeddingAuth from "../features/wedding-hub/components/RequireWeddingAuth";
import CheckWeddingAuth from "../features/wedding-hub/components/CheckWeddingAuth";

const opts = { fallback: <AncaLoader /> };

const WeddingHubLayout = loadable(() => import("../features/wedding-hub/WeddingHubLayout"), opts);
const WeddingLoginPage = loadable(() => import("../features/wedding-hub/pages/WeddingLogin"), opts);
const WeddingDashboard = loadable(() => import("../features/wedding-hub/pages/WeddingDashboard"), opts);
const GuestManagerPage = loadable(() => import("../features/wedding-hub/pages/GuestManagerPage"), opts);
const SeatingPlanPage = loadable(() => import("../features/wedding-hub/pages/SeatingPlanPage"), opts);
const WeddingMessagesPage = loadable(() => import("../features/wedding-hub/pages/WeddingMessagesPage"), opts);
const WeddingSettingsPage = loadable(() => import("../features/wedding-hub/pages/WeddingSettingsPage"), opts);
const WeddingMockLabPage = loadable(() => import("../features/wedding-hub/pages/WeddingMockLabPage"), opts);
const ChecklistPage = loadable(() => import("../features/wedding-hub/pages/ChecklistPage"), opts);
const TimelinePage = loadable(() => import("../features/wedding-hub/pages/TimelinePage"), opts);

export const weddingHubRoutes = [
  <Route key="wedding-hub" element={<WeddingHubAuthWrapper />}>
    <Route element={<CheckWeddingAuth />}>
      <Route path="/wedding-hub/login" element={<WeddingLoginPage />} />
    </Route>
    <Route element={<RequireWeddingAuth />}>
      <Route element={<WeddingHubLayout />}>
        <Route path="/wedding-hub/dashboard" element={<WeddingDashboard />} />
        <Route path="/wedding-hub/guests" element={<GuestManagerPage />} />
        <Route path="/wedding-hub/seating" element={<SeatingPlanPage />} />
        <Route path="/wedding-hub/messages" element={<WeddingMessagesPage />} />
        <Route path="/wedding-hub/timeline" element={<TimelinePage />} />
        <Route path="/wedding-hub/checklist" element={<ChecklistPage />} />
        <Route path="/wedding-hub/mock" element={<WeddingMockLabPage />} />
        <Route path="/wedding-hub/settings" element={<WeddingSettingsPage />} />
      </Route>
    </Route>
  </Route>,
];
