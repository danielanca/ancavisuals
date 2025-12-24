// components/AdminArea/CheckAuth.tsx
import React from "react";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/hooks/useAuth";
import RouteSpinner from "../UI/RouteSpinner";

const CheckAuth: React.FC = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const loading = auth?.loading ?? false;

  if (loading) return <RouteSpinner />;

  // If already logged in, skip the login page
  return auth?.authorise ? (
    <Navigate to="/admin" state={{ from: location }} replace />
  ) : (
    <Outlet />
  );
};

export default CheckAuth;
