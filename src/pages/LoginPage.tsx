import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Simulação: determinar role baseado em email
function determineRole(email: string): "paciente" | "profissional" | "admin" {
  if (email.includes("admin") || email.includes("@admin.")) {
    return "admin";
  }
  if (email.includes("doutor") || email.includes("dr") || email.includes("@medico.") || email.includes("profissional")) {
    return "profissional";
  }
  return "paciente";
}

// Simulação: redirecionar baseado em role
function getRoleRedirect(role: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "profissional":
      return "/profissional";
    default:
      return "/paciente";
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulação de login
    setTimeout(() => {
      if (loginEmail && loginPass) {
        const role = determineRole(loginEmail);
        
        // Guardar sessão simulada
        localStorage.setItem("user", JSON.stringify({
          email: loginEmail,
          role: role,
          name: loginEmail.split("@")[0]
        }));

        toast.success(`Bem-vindo! Acesso como ${role}`);
        navigate(getRoleRedirect(role));
      } else {
        toast.error("Por favor preencha todos os campos");
      }
      setIsLoading(false);
    }, 800);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulação de registo
    setTimeout(() => {
      if (regName && regEmail && regPass) {
        const role = determineRole(regEmail);
        
        // Guardar sessão simulada
        localStorage.setItem("user", JSON.stringify({
          email: regEmail,
          role: role,
          name: regName
        }));

        toast.success(`Conta criada! Acesso como ${role}`);
        navigate(getRoleRedirect(role));
      } else {
        toast.error("Por favor preencha todos os campos");
      }
      setIsLoading(false);
    }, 800);
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
            Acesso unificado para pacientes, profissionais e administradores. O sistema identifica automaticamente o seu tipo de conta.
          </p>
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
            <p className="text-sm text-muted-foreground">Entre na sua conta ou crie uma nova.</p>
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
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="login-email" 
                      type="email" 
                      placeholder="email@exemplo.com" 
                      className="pl-10 h-11" 
                      value={loginEmail} 
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dica: use "admin@", "doutor@" ou "paciente@" no email
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-pass">Password</Label>
                    <button type="button" className="text-xs text-primary hover:underline">
                      Esqueci a password
                    </button>
                  </div>
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
                  <Label htmlFor="reg-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="email@exemplo.com" 
                      className="pl-10 h-11" 
                      value={regEmail} 
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dica: use "admin@", "doutor@" ou "paciente@" no email
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
