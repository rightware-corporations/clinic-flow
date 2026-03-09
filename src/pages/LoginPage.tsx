import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight, Stethoscope, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// Determinar role baseado no prefixo do ID
function determineRole(id: string): "paciente" | "profissional" | "admin" | null {
  const upper = id.toUpperCase();
  if (upper.startsWith("A")) return "admin";
  if (upper.startsWith("M")) return "profissional";
  if (upper.startsWith("C")) return "paciente";
  return null;
}

function getRoleRedirect(role: string): string {
  switch (role) {
    case "admin": return "/admin";
    case "profissional": return "/profissional";
    default: return "/paciente";
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "admin": return "Administrador";
    case "profissional": return "Médico";
    default: return "Cliente";
  }
}

function validateId(id: string): boolean {
  return /^[AaMmCc]\d{3,}$/.test(id);
}

function generateId(role: "paciente" | "profissional" | "admin"): string {
  const prefix = role === "admin" ? "A" : role === "profissional" ? "M" : "C";
  const randomNum = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  return `${prefix}${randomNum}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regId, setRegId] = useState("");
  const [regPass, setRegPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const id = loginId.toUpperCase();
      if (!validateId(id)) {
        toast.error("ID inválido. Use o formato: M001, C001 ou A001");
        setIsLoading(false);
        return;
      }
      const role = determineRole(id);
      if (!role) {
        toast.error("Prefixo de ID não reconhecido");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("user", JSON.stringify({
        id,
        role,
        name: id,
      }));
      window.dispatchEvent(new Event("auth-change"));
      toast.success(`Bem-vindo! Acesso como ${getRoleLabel(role)}`);
      navigate(getRoleRedirect(role));
      setIsLoading(false);
    }, 600);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const id = regId.toUpperCase();
      if (!validateId(id)) {
        toast.error("ID inválido. Use o formato: M001, C001 ou A001");
        setIsLoading(false);
        return;
      }
      const role = determineRole(id);
      if (!role) {
        toast.error("Prefixo de ID não reconhecido");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("user", JSON.stringify({
        id,
        role,
        name: regName || id,
      }));
      window.dispatchEvent(new Event("auth-change"));
      toast.success(`Conta criada! Acesso como ${getRoleLabel(role)}`);
      navigate(getRoleRedirect(role));
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — desktop */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-primary via-secondary to-accent items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        </div>
        <div className="max-w-md text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-8 backdrop-blur-sm border border-primary-foreground/10">
            <Stethoscope className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-3">MedClínica</h2>
          <p className="text-sm uppercase tracking-widest text-primary-foreground/50 mb-6">Sistema de Gestão</p>
          <p className="text-primary-foreground/70 leading-relaxed">
            Acesso unificado por ID. O sistema identifica automaticamente o seu tipo de conta pelo prefixo do ID.
          </p>
          <div className="mt-6 space-y-2 text-left bg-primary-foreground/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold text-primary-foreground/80 uppercase tracking-wider mb-3">Classes de ID</p>
            <div className="flex items-center gap-3 text-sm text-primary-foreground/70">
              <span className="font-mono font-bold text-primary-foreground bg-primary-foreground/10 px-2 py-0.5 rounded">M###</span>
              <span>Médicos / Profissionais</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-primary-foreground/70">
              <span className="font-mono font-bold text-primary-foreground bg-primary-foreground/10 px-2 py-0.5 rounded">C###</span>
              <span>Clientes / Pacientes</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-primary-foreground/70">
              <span className="font-mono font-bold text-primary-foreground bg-primary-foreground/10 px-2 py-0.5 rounded">A###</span>
              <span>Administradores</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-[400px]">
          {/* Mobile header */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl medical-gradient flex items-center justify-center mb-3">
              <Stethoscope className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">MedClínica</h1>
            <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold mb-1">Bem-vindo de volta</h1>
            <p className="text-sm text-muted-foreground">Entre com o seu ID e password.</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Registar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
                onSubmit={handleLogin}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="login-id">ID de Utilizador</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-id"
                      placeholder="Ex: M001, C001, A001"
                      className="pl-10 h-11 uppercase font-mono"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                      maxLength={10}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    M = Médico · C = Cliente · A = Admin
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pass">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-pass"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 h-11"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 medical-gradient border-0 gap-2 text-sm font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? "A entrar..." : "Entrar"} <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.form>
            </TabsContent>

            <TabsContent value="register">
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
                onSubmit={handleRegister}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-name"
                      placeholder="João Silva"
                      className="pl-10 h-11"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-id">ID de Utilizador</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-id"
                      placeholder="Ex: M001, C001, A001"
                      className="pl-10 h-11 uppercase font-mono"
                      value={regId}
                      onChange={(e) => setRegId(e.target.value.toUpperCase())}
                      maxLength={10}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    M = Médico · C = Cliente · A = Admin
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reg-pass"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 h-11"
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 medical-gradient border-0 gap-2 text-sm font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? "A criar conta..." : "Criar Conta"} <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
