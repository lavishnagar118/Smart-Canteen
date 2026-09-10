import { Navigate, Outlet } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

export default function RoleProtectedRoute({ roles }) {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <LoadingSpinner label="Checking access..." />;
  if (!isAuthenticated || !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
