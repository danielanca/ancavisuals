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
import AnalyticsPage from "./features/admin/components/AnalyticsPage";
import ImageOptimizerPage from "./features/admin/components/ImageOptimizerPage";
import GoalDetailPage from "./features/admin/components/GoalDetailPage";
import BankDetailsPage from "./features/admin/components/BankDetailsPage";
import ModerationReviewPage from "./features/admin/components/Moderation/ModerationReviewPage";
import ErrorsPage from "./features/admin/components/ErrorsPage";
import RevinPage from "./pages/Revin/RevinPage";
import { usePageTracking } from "./hooks/usePageTracking";
import { useClientErrorReporting } from "./hooks/useClientErrorReporting";


const HIDE_CHAT_PREFIXES = ["/admin", "/login", "/media", "/contract", "/revin"];

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
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/image-optimizer" element={<ImageOptimizerPage />} />
            <Route path="/admin/bank-details" element={<BankDetailsPage />} />
            <Route path="/admin/goals/:type" element={<GoalDetailPage />} />
            <Route path="/admin/moderare" element={<ModerationReviewPage />} />
            <Route path="/admin/errors" element={<ErrorsPage />} />
          </Route>


          {/* Login-only routes */}
          <Route element={<CheckAuth />}>
            <Route path="/login" element={<Login />} />
          </Route>
          
          

        </Routes>
      </Suspense>
      </AuthProvider>
    </ContextWrapper>
  );
};

export default App;
