import React, { Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import AncaChat from "./features/chat/components/AncaChat";
import AncaLoader from "./components/UI/AncaLoader";
import { useLocation } from "react-router-dom";
import routes from "./routes/publicRoutes";
import { ContextWrapper } from "./Context"; // Assuming you have this component

import CheckAuth from "./features/admin/components/CheckAuth";
import RequireAuth from "./features/admin/components/RequireAuth";
import Login from "./features/admin/components/Login";
import { AuthProvider } from "./features/admin/providers/AuthProvider";
import Dashboard from "./features/admin/components/Dashboard";
import CreateEventWedding from "./features/admin/components/EventDashboard/CreateEvent";
import AdminBook from "./pages/Contact/booking/AdminBook";
import BookedCalendar from "./features/admin/components/BookedCalendar";
import ContractListPage from "./features/admin/components/Contracts/ContractListPage";
import CreateContractPage from "./features/admin/components/Contracts/CreateContractPage";
import EditContractPage from "./features/admin/components/Contracts/EditContractPage";
import InspirationPage from "./features/admin/components/InspirationPage";
import MementosPage from "./features/admin/components/MementosPage";
import MediaActivityPage from "./features/admin/components/MediaActivityPage";
import QRMomentsAdminPage from "./features/admin/components/QRMomentsAdminPage";
import AnalyticsPage from "./features/admin/components/AnalyticsPage";
import ImageOptimizerPage from "./features/admin/components/ImageOptimizerPage";
import GoalDetailPage from "./features/admin/components/GoalDetailPage";
import BankDetailsPage from "./features/admin/components/BankDetailsPage";
import ModerationReviewPage from "./features/admin/components/Moderation/ModerationReviewPage";
import RouteSheetsPage from "./features/admin/components/RouteSheets/RouteSheetsPage";
import ErrorsPage from "./features/admin/components/ErrorsPage";
import FinancialPage from "./features/admin/components/Financial/FinancialPage";
import LandingAdminPage from "./features/admin/components/Landing/LandingAdminPage";
import CollaboratorPage from "./features/collaborator/CollaboratorPage";
import AccountsPage from "./features/admin/components/AccountsPage";
import InstagramProposalsAdminPage from "./features/admin/components/InstagramProposalsAdminPage";
import OferteAdminPage from "./features/admin/components/OferteAdminPage";
import OfertaPage from "./pages/OfertaPage";
import WeddingHubAdminPage from "./features/admin/components/WeddingHub/WeddingHubAdminPage";
import WeddingHubAuthWrapper from "./features/wedding-hub/WeddingHubAuthWrapper";
import WeddingHubLayout from "./features/wedding-hub/WeddingHubLayout";
import RequireWeddingAuth from "./features/wedding-hub/components/RequireWeddingAuth";
import CheckWeddingAuth from "./features/wedding-hub/components/CheckWeddingAuth";
import WeddingLoginPage from "./features/wedding-hub/pages/WeddingLogin";
import WeddingDashboard from "./features/wedding-hub/pages/WeddingDashboard";
import GuestManagerPage from "./features/wedding-hub/pages/GuestManagerPage";
import SeatingPlanPage from "./features/wedding-hub/pages/SeatingPlanPage";
import WeddingMessagesPage from "./features/wedding-hub/pages/WeddingMessagesPage";
import GuestInvitationPage from "./features/wedding-hub/pages/GuestInvitationPage";
import WeddingSettingsPage from "./features/wedding-hub/pages/WeddingSettingsPage";
import WeddingMockLabPage from "./features/wedding-hub/pages/WeddingMockLabPage";
import ChecklistPage from "./features/wedding-hub/pages/ChecklistPage";
import TimelinePage from "./features/wedding-hub/pages/TimelinePage";
import RevinPage from "./pages/Revin/RevinPage";
import { usePageTracking } from "./hooks/usePageTracking";
import { useClientErrorReporting } from "./hooks/useClientErrorReporting";
import AdminBar from "./components/UI/AdminBar";
import useAuth from "./features/admin/auth/useAuth";

function AdminSpacer() {
  const { auth } = useAuth();
  return auth.authorise ? <div style={{ height: 48 }} /> : null;
}


const HIDE_CHAT_PREFIXES = ["/admin", "/login", "/media", "/contract", "/revin", "/colaborator", "/qr-moments", "/wedding-hub", "/invite"];

export const App = () => {
  const location = useLocation();
  const showChat = !HIDE_CHAT_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  usePageTracking();
  useClientErrorReporting();

  useEffect(() => {
    // Removes the privacy dialog from the DOM if it exists
    const removeUcDialog = () => {
      const dialog = document.getElementById("uc-main-dialog");
      if (dialog && dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }
    };

    // 1) Try immediately (if already in the DOM)
    removeUcDialog();

    // 2) Observe the DOM in case the script adds it later
    const observer = new MutationObserver(() => {
      removeUcDialog();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <ContextWrapper>
      <AuthProvider>
      <AdminBar />
      <AdminSpacer />
      <Suspense fallback={<AncaLoader />}>
        {showChat && <AncaChat />}
        <Routes>
           {/* Public / general routes */}
           {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component />}
            />
          ))}

          {/* Photobooth pause screen — public, no auth, no index */}
          <Route path="/revin" element={<RevinPage />} />

          {/* Auth-protected admin routes */}
          <Route element={<RequireAuth />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/calendar" element={<BookedCalendar />} />
            <Route path="/admin/create-event" element={<AdminBook />} />
            <Route path="/admin/create-event-wedding" element={<CreateEventWedding />} />
            <Route path="/admin/contracts" element={<ContractListPage />} />
            <Route path="/admin/contracts/create" element={<CreateContractPage />} />
            <Route path="/admin/contracts/:id/edit" element={<EditContractPage />} />
            <Route path="/admin/inspiration" element={<InspirationPage />} />
            <Route path="/admin/mementos" element={<MementosPage />} />
            <Route path="/admin/media-activity" element={<MediaActivityPage />} />
            <Route path="/admin/qr-moments" element={<QRMomentsAdminPage />} />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/image-optimizer" element={<ImageOptimizerPage />} />
            <Route path="/admin/bank-details" element={<BankDetailsPage />} />
            <Route path="/admin/goals/:type" element={<GoalDetailPage />} />
            <Route path="/admin/moderare" element={<ModerationReviewPage />} />
            <Route path="/admin/route-sheets" element={<RouteSheetsPage />} />
            <Route path="/admin/errors" element={<ErrorsPage />} />
            <Route path="/admin/route-sheets" element={<RouteSheetsPage />} />
            <Route path="/admin/financial" element={<FinancialPage />} />
            <Route path="/admin/landing" element={<LandingAdminPage />} />
            <Route path="/colaborator" element={<CollaboratorPage />} />
            <Route path="/admin/accounts" element={<AccountsPage />} />
            <Route path="/admin/instagram-proposals" element={<InstagramProposalsAdminPage />} />
            <Route path="/admin/oferte" element={<OferteAdminPage />} />
            <Route element={<WeddingHubAuthWrapper />}>
              <Route path="/admin/wedding-hub" element={<WeddingHubAdminPage />} />
            </Route>
          </Route>

          {/* Login-only routes */}
          <Route element={<CheckAuth />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Public guest invitation page */}
          <Route path="/invite/:token" element={<GuestInvitationPage />} />

          {/* Public offer pages */}
          <Route path="/oferta/:slug" element={<OfertaPage />} />
          <Route path="/oferta" element={<OfertaPage />} />

          {/* Wedding Hub — couple-facing (separate Firebase Auth instance) */}
          <Route element={<WeddingHubAuthWrapper />}>
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
          </Route>
          
          

        </Routes>
      </Suspense>
      </AuthProvider>
    </ContextWrapper>
  );
};

export default App;
