import React, { Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import routes from "./routes/routes";
import { ContextWrapper } from "./Context"; // Assuming you have this component

import CheckAuth from "./components/AdminArea/checkAuth";
import RequireAuth from "./components/AdminArea/RequireAuth";
import Login from "./components/AdminArea/Login";
import { AuthProvider } from "./components/context/AuthProvider";
import Dashboard from "./components/AdminArea/Dashboard";


export const App = () => {
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
      <Suspense fallback={<div>LOADING URS...</div>}>
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
