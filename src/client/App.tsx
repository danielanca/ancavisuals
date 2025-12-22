import React, { Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import routes from "./routes/routes";
import { ContextWrapper } from "./Context"; // Assuming you have this component

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
      <Suspense fallback={<div>LOADING URS...</div>}>
        <Routes>
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={<route.component />} />
          ))}
        </Routes>
      </Suspense>
    </ContextWrapper>
  );
};

export default App;
