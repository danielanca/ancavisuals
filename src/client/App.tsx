import React, { Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import loadable from "@loadable/component";
import { AuthProvider } from "./features/admin/providers/AuthProvider";
import AdminBar from "./components/UI/AdminBar";
import AncaLoader from "./components/UI/AncaLoader";
import { usePageTracking } from "./hooks/usePageTracking";
import { useClientErrorReporting } from "./hooks/useClientErrorReporting";
import { useVisitorNotification } from "./hooks/useVisitorNotification";
import useAuth from "./features/admin/auth/useAuth";
import publicRoutes from "./routes/publicRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { weddingHubRoutes } from "./routes/weddingHubRoutes";

const AncaChat = loadable(() => import("./features/chat/components/AncaChat"), { fallback: <></> });

const HIDE_CHAT_PREFIXES = ["/admin", "/login", "/media", "/contract", "/revin", "/colaborator", "/qr-moments", "/wedding-hub", "/invite", "/oferta"];

function AdminSpacer() {
  const { auth } = useAuth();
  return auth.authorise ? <div style={{ height: 48 }} /> : null;
}

export const App = () => {
  const location = useLocation();
  const showChat = !HIDE_CHAT_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  usePageTracking();
  useClientErrorReporting();
  useVisitorNotification();

  useEffect(() => {
    const removeUcDialog = () => {
      const dialog = document.getElementById("uc-main-dialog");
      if (dialog?.parentNode) dialog.parentNode.removeChild(dialog);
    };
    removeUcDialog();
    const observer = new MutationObserver(removeUcDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <AuthProvider>
        <AdminBar />
        <AdminSpacer />
        <Suspense fallback={<AncaLoader />}>
          {showChat && <AncaChat />}
          <Routes>
            {publicRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={<route.component />} />
            ))}
            {...adminRoutes()}
            {...weddingHubRoutes()}
          </Routes>
        </Suspense>
    </AuthProvider>
  );
};

export default App;
