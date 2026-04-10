import React, { Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import AncaChat from "./components/AncaChat/AncaChat";
import AncaLoader from "./components/UI/AncaLoader";
import { useLocation } from "react-router-dom";
import routes from "./routes/publicRoutes";
import { ContextWrapper } from "./Context"; // Assuming you have this component

import CheckAuth from "./components/AdminArea/checkAuth";
import RequireAuth from "./components/AdminArea/RequireAuth";
import Login from "./components/AdminArea/Login";
import { AuthProvider } from "./components/context/AuthProvider";
import Dashboard from "./components/AdminArea/Dashboard";
import CreateEventWedding from "./components/AdminArea/EventDashboard/CreateEvent";
import AdminBook from "./pages/Contact/booking/AdminBook";
import BookedCalendar from "./components/AdminArea/BookedCalendar";


const HIDE_CHAT_PREFIXES = ["/admin", "/login", "/media"];

export const App = () => {
  const location = useLocation();
  const showChat = !HIDE_CHAT_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  useEffect(() => {
    // Funcție care șterge dialogul de privacy dacă există
    const removeUcDialog = () => {
      const dialog = document.getElementById("uc-main-dialog");
      if (dialog && dialog.parentNode) {
        dialog.parentNode.removeChild(dialog);
      }
    };

    // 1) Încearcă imediat (dacă deja e în DOM)
    removeUcDialog();

    // 2) Observă DOM-ul în caz că scriptul îl adaugă mai târziu
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

          {/* Auth-protected admin routes */}
          <Route element={<RequireAuth />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/calendar" element={<BookedCalendar />} />
            <Route path="/admin/create-event" element={<AdminBook />} />
            <Route path="/admin/create-event-wedding" element={<CreateEventWedding />} />
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
