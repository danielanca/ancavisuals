import React, { Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import loadable from "@loadable/component";
import { AuthProvider } from "./features/admin/providers/AuthProvider";
import { ErrorMonitorProvider } from "./features/admin/providers/ErrorMonitorContext";
import AdminBar from "./components/UI/AdminBar";
import AncaLoader from "./components/UI/AncaLoader";
import ErrorMonitorPanel from "./features/admin/components/ErrorMonitorPanel";
import ClientDebugBadge from "./features/admin/components/ClientDebugBadge";
import { usePageTracking } from "./hooks/usePageTracking";
import { useClientErrorReporting } from "./hooks/useClientErrorReporting";
import { useVisitorNotification } from "./hooks/useVisitorNotification";
import publicRoutes from "./routes/publicRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { weddingHubRoutes } from "./routes/weddingHubRoutes";

const AncaChat = loadable(() => import("./features/chat/components/AncaChat"), { fallback: <></> });

const HIDE_CHAT_PREFIXES = ["/admin", "/login", "/contract", "/revin", "/colaborator", "/qr-moments", "/wedding-hub", "/invite", "/oferta", "/backup"];

export const App = () => {
  const location = useLocation();
  const [mediaPromoVisible, setMediaPromoVisible] = useState(false);
  const isMediaPage = location.pathname.startsWith("/media/");
  const baseChatAllowed = !HIDE_CHAT_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  const showChat = isMediaPage ? mediaPromoVisible : baseChatAllowed;
  usePageTracking();
  useClientErrorReporting();
  useVisitorNotification();

  const suppressCookieBot = location.pathname.startsWith("/media") || location.pathname.startsWith("/admin");

  useEffect(() => {
    const STYLE_ID = "uc-suppress-style";
    if (suppressCookieBot) {
      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = "[id^='uc-'], [class^='uc-'], #usercentrics-root { display: none !important; }";
        document.head.appendChild(style);
      }
      // Also remove any already-present nodes for UC dialog
      const removeUcNodes = () => {
        document.querySelectorAll("[id^='uc-'], #usercentrics-root").forEach((el) => el.remove());
      };
      removeUcNodes();
      const observer = new MutationObserver(removeUcNodes);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    } else {
      document.getElementById(STYLE_ID)?.remove();
    }
  }, [suppressCookieBot]);

  useEffect(() => {
    if (!isMediaPage) {
      setMediaPromoVisible(false);
      return;
    }

    const target = document.getElementById("media-promo-zone");
    if (!target) {
      setMediaPromoVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setMediaPromoVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isMediaPage, location.pathname]);

  return (
    <ErrorMonitorProvider>
      <AuthProvider>
          <AdminBar />
          <ErrorMonitorPanel />
          <ClientDebugBadge />
          <Suspense fallback={<AncaLoader />}>
            {showChat && <AncaChat />}
            <Routes>
              {publicRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<route.component />} />
              ))}
              {adminRoutes}
              {weddingHubRoutes}
            </Routes>
          </Suspense>
      </AuthProvider>
    </ErrorMonitorProvider>
  );
};

export default App;
