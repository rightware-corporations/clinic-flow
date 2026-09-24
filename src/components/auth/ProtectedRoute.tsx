import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { me, type ClinicMembership } from "@/lib/clinicflow-api";

type LegacyRole = "admin" | "staff" | "profissional" | "interno" | "paciente";
const roleMap: Record<ClinicMembership["role"], LegacyRole> = {
  CLINIC_ADMIN: "admin",
  RECEPTION: "staff",
  PRACTITIONER: "profissional",
  INTERN: "interno",
  PATIENT: "paciente",
};
const dashboard: Record<LegacyRole, string> = {
  admin: "/admin", staff: "/staff", profissional: "/profissional",
  interno: "/interno", paciente: "/paciente",
};

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

/** Authoritative session and membership verification, never localStorage-based auth. */
export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [state, setState] = useState<"loading" | "verified" | "unauthenticated" | "error">("loading");
  const [role, setRole] = useState<LegacyRole | null>(null);

  useEffect(() => {
    let live = true;
    me().then(current => {
      if (!live) return;
      const preferred = sessionStorage.getItem("clinicflow:tenant");
      const membership = current.memberships.find(item => item.tenantId === preferred)
        ?? current.memberships[0];
      if (!membership) {
        setRole(null);
        setState("unauthenticated");
        return;
      }
      const verifiedRole = roleMap[membership.role];
      sessionStorage.setItem("clinicflow:tenant", membership.tenantId);
      localStorage.setItem("user", JSON.stringify({
        id: current.id, name: current.displayName, email: current.email,
        role: verifiedRole, tenantId: membership.tenantId,
      })); // display-only legacy compatibility
      window.dispatchEvent(new Event("auth-change"));
      setRole(verifiedRole);
      setState("verified");
    }).catch(error => {
      if (!live) return;
      const isUnauthorized = error instanceof Error && error.message.includes("401");
      if (isUnauthorized) {
        localStorage.removeItem("user");
        sessionStorage.removeItem("clinicflow:tenant");
        window.dispatchEvent(new Event("auth-change"));
      }
      setState(isUnauthorized ? "unauthenticated" : "error");
    });
    return () => { live = false; };
  }, []);

  if (state === "loading") {
    return <div className="min-h-screen grid place-items-center" role="status">
      A verificar sessão...
    </div>;
  }
  if (state === "error") {
    return <div className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <p>Não foi possível verificar a sessão. Verifique a ligação.</p>
        <button type="button" className="underline mt-4"
          onClick={() => window.location.reload()}>Tentar novamente</button>
      </div>
    </div>;
  }
  if (state === "unauthenticated" || !role) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={dashboard[role]} replace />;
  }
  return <>{children}</>;
}
