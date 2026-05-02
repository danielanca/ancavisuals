import React from "react";
import { Outlet } from "react-router-dom";
import { WeddingHubAuthProvider } from "./context/WeddingHubAuthContext";
import { WeddingHubThemeProvider } from "./context/WeddingHubThemeContext";

const WeddingHubAuthWrapper: React.FC = () => (
  <WeddingHubThemeProvider>
    <WeddingHubAuthProvider>
      <Outlet />
    </WeddingHubAuthProvider>
  </WeddingHubThemeProvider>
);

export default WeddingHubAuthWrapper;
