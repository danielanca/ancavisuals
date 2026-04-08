// components/AdminArea/RequireAuth.tsx
import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/hooks/useAuth";
import RouteSpinner from "../UI/RouteSpinner";

const RequireAuth: React.FC = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const loading = auth?.loading ?? false;

  if (loading) return <RouteSpinner />; // wait for Firebase/cookie check

  // allow if authorised, otherwise kick to /login
  return auth?.authorise ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location }} replace />
  );
};

export default RequireAuth;
