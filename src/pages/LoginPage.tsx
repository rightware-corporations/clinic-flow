import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, logout, type ClinicMembership } from "@/lib/clinicflow-api";

/** The frontend never assigns roles; they come from verified server memberships. */
function dashboardFor(role: ClinicMembership["role"]): string {
  switch (role) {
    case "CLINIC_ADMIN": return "/admin";
    case "RECEPTION": return "/staff";
    case "PRACTITIONER": return "/profissional";
    case "NURSE": return "/enfermagem";
    case "INTERN": return "/interno";
    case "PATIENT": return "/paciente";
  }
}

const displayRole: Record<ClinicMembership["role"], string> = {
  CLINIC_ADMIN: "admin",
  RECEPTION: "staff",
  PRACTITIONER: "profissional",
  NURSE: "enfermagem",
  INTERN: "interno",
  PATIENT: "paciente",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const current = await login(email.trim(), password);
      const preferred = sessionStorage.getItem("clinicflow:tenant");
      const membership = current.memberships.find(m => m.tenantId === preferred)
        ?? current.memberships[0];
      if (!membership) {
        await logout();
        toast.error("Sem clínica activa. Contacte a administração.");
        return;
      }
      // Session cookie (HttpOnly) is the only authentication authority.
      // localStorage is retained as a display cache for legacy dashboard components.
      sessionStorage.setItem("clinicflow:tenant", membership.tenantId);
      localStorage.setItem("user", JSON.stringify({
        id: current.id, name: current.displayName, email: current.email,
        role: displayRole[membership.role], tenantId: membership.tenantId,
      }));
      window.dispatchEvent(new Event("auth-change"));
      navigate(dashboardFor(membership.role), { replace: true });
    } catch (error) {
      toast.error(error instanceof Error && error.message.includes("401")
        ? "Email ou palavra-passe inválidos."
        : "Não foi possível iniciar sessão. Verifique a ligação ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex bg-background">
      <section className="hidden lg:flex lg:w-[45%] bg-primary text-primary-foreground
          items-center justify-center p-12">
        <div className="max-w-md space-y-5">
          <img src="/med-clinica-mark.svg" alt="" className="w-16 h-16 object-contain" />
          <p className="uppercase tracking-widest text-sm opacity-75">Sistema de gestão clínica</p>
          <h1 className="text-4xl font-bold">MED Clinica</h1>
          <p className="text-base opacity-85 leading-relaxed">
            Aceda à sua clínica com as credenciais atribuídas pela administração.
            As permissões são verificadas no servidor.
          </p>
        </div>
      </section>
      <section className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px]">
          <img src="/med-clinica-mark.svg" alt="" className="w-12 h-12 mb-5 lg:hidden" />
          <h2 className="text-2xl font-bold mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Entre com o email e palavra-passe da sua conta.
          </p>
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="login-email" type="email" autoComplete="username"
                  placeholder="nome@clinica.com" className="pl-10 h-11"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Palavra-passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="login-password" type="password" autoComplete="current-password"
                  className="pl-10 h-11" value={password}
                  onChange={e => setPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 medical-gradient border-0 gap-2"
              disabled={loading}>
              {loading ? "A autenticar..." : "Entrar"} <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.form>
          <p className="mt-5 text-xs text-muted-foreground">
            O registo de administradores e profissionais é efectuado pela plataforma.
            O auto-registo fica indisponível até existir um processo seguro de convites.
          </p>
          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar ao início
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
