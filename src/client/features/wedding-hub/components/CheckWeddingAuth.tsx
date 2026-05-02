import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import Loader from "../../../components/UI/Loader";

const CheckWeddingAuth: React.FC = () => {
  const { coupleAuth } = useWeddingHubAuth();
  const location = useLocation();

  if (coupleAuth.coupleLoading) return <Loader variant="fullscreen" subtitle="Wedding Planner" />;

  return coupleAuth.coupleAuthorised ? (
    <Navigate to="/wedding-hub/dashboard" state={{ from: location }} replace />
  ) : (
    <Outlet />
  );
};

export default CheckWeddingAuth;
