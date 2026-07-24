// Layout-route guard for the authed Run It Back pages. Renders the nested
// routes only when logged in; otherwise bounces to the login page, preserving
// where the user was headed so login can return them there.
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-gray-400">Loading…</div>;
  }
  if (!user) {
    return (
      <Navigate to="/run-it-back/login" replace state={{ from: location }} />
    );
  }
  return <Outlet />;
}
