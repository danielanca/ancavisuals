import React from "react";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import useAuth from "../auth/useAuth";
import Loader from "../../../components/UI/Loader";

const CheckAuth: React.FC = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const loading = auth?.loading ?? false;

  if (loading) return <Loader variant="fullscreen" />;

  // If already logged in, skip the login page
  return auth?.authorise ? (
    <Navigate to="/admin" state={{ from: location }} replace />
  ) : (
    <Outlet />
  );
};

export default CheckAuth;
 
