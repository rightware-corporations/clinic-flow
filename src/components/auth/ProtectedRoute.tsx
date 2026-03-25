import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

/**
 * ProtectedRoute — Role-based access control
 * 
 * Roles: admin, profissional, staff, interno, paciente
 * Redirects unauthenticated users to /login
 * Redirects unauthorized users to their role's dashboard
 */
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const userStr = localStorage.getItem("user");
  let user = null;
  
  if (userStr) {
    try { user = JSON.parse(userStr); } catch { /* ignore */ }
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectMap: Record<string, string> = {
      admin: "/admin",
      profissional: "/profissional",
      staff: "/staff",
      interno: "/interno",
      paciente: "/paciente",
    };
    return <Navigate to={redirectMap[user.role] || "/paciente"} replace />;
  }

  return <>{children}</>;
}
