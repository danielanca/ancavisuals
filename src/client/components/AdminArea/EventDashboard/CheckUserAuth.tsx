// components/AdminArea/CheckAuth.tsx
import React from "react";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import useAuth from "../../hooks/hooks/useAuth";
import RouteSpinner from "../../UI/RouteSpinner";

const CheckUserAuth: React.FC = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const loading = auth?.loading ?? false;

  if (loading) return <RouteSpinner />;

  // If already logged in, Be allowed to create Event
  return auth?.authorise ? (
    <Navigate to="/create-event" state={{ from: location }} replace />
  ) : (
    <Navigate to="/see-event" state={{ from: location }} replace />

  );
};

export default CheckUserAuth;
