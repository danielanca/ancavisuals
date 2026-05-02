import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";
import Loader from "../../../components/UI/Loader";

const RequireWeddingAuth: React.FC = () => {
  const { coupleAuth } = useWeddingHubAuth();
  const location = useLocation();

  if (coupleAuth.coupleLoading) return <Loader variant="fullscreen" subtitle="Wedding Planner" />;

  return coupleAuth.coupleAuthorised ? (
    <Outlet />
  ) : (
    <Navigate to="/wedding-hub/login" state={{ from: location }} replace />
  );
};

export default RequireWeddingAuth;
