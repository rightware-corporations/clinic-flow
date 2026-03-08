import { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Stethoscope, ShieldCheck, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Role = "paciente" | "profissional" | "admin";

const roleConfig: Record<Role, { title: string; subtitle: string; icon: React.ReactNode; redirect: string; color: string }> = {
  paciente: {
    title: "Área do Paciente",
    subtitle: "Aceda às suas marcações e histórico clínico.",
    icon: <User className="w-10 h-10 text-primary-foreground" />,
    redirect: "/paciente",
    color: "from-primary to-secondary",
  },
  profissional: {
    title: "Área Profissional",
    subtitle: "Gerir agenda, consultas e pacientes.",
    icon: <Briefcase className="w-10 h-10 text-primary-foreground" />,
    redirect: "/profissional",
    color: "from-secondary to-accent",
  },
  admin: {
    title: "Administração",
    subtitle: "Painel de gestão da clínica.",
    icon: <ShieldCheck className="w-10 h-10 text-primary-foreground" />,
    redirect: "/admin",
    color: "from-accent to-primary",
  },
};

function LoginForm({ role }: { role: Role }) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

  const config = roleConfig[role];

  return (
    <div className="min-h-screen flex">
      {/* Left panel — desktop */}
      <div className={`hidden lg:flex lg:w-[45%] bg-gradient-to-br ${config.color} items-center justify-center p-12 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        </div>
        <div className="max-w-md text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-8 backdrop-blur-sm border border-primary-foreground/10">
            {config.icon}
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-3">MedClínica</h2>
          <p className="text-sm uppercase tracking-widest text-primary-foreground/50 mb-6">{config.title}</p>
          <p className="text-primary-foreground/70 leading-relaxed">{config.subtitle}</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-[400px]">
          {/* Mobile header */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-3`}>
              <Stethoscope className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-xs text-muted-foreground">MedClínica</p>
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="email@exemplo.com" className="pl-10 h-11" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-pass">Password</Label>
                    <button className="text-xs text-primary hover:underline">Esqueci a password</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-pass" type="password" placeholder="••••••••" className="pl-10 h-11" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full h-11 medical-gradient border-0 gap-2 text-sm font-semibold">
                  Entrar <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </TabsContent>

            <TabsContent value="register">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="reg-name" placeholder="João Silva" className="pl-10 h-11" value={regName} onChange={(e) => setRegName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="reg-email" type="email" placeholder="email@exemplo.com" className="pl-10 h-11" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-pass">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="reg-pass" type="password" placeholder="••••••••" className="pl-10 h-11" value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full h-11 medical-gradient border-0 gap-2 text-sm font-semibold">
                  Criar Conta <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center space-y-2">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors block">
              ← Voltar ao início
            </Link>
            <Link to="/login" className="text-xs text-primary hover:underline block">
              Escolher outro tipo de conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleSelector() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-2xl medical-gradient flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-1">MedClínica</h1>
        <p className="text-sm text-muted-foreground">Selecione o tipo de acesso</p>
      </div>

      <div className="grid gap-4 w-full max-w-sm">
        {(Object.entries(roleConfig) as [Role, typeof roleConfig[Role]][]).map(([role, config], i) => (
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link to={`/login/${role}`}>
              <div className="medical-card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shrink-0`}>
                  {config.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors">{config.title}</p>
                  <p className="text-xs text-muted-foreground">{config.subtitle}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <Link to="/" className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Voltar ao início
      </Link>
    </div>
  );
}

export default function LoginPage() {
  const { role } = useParams<{ role?: string }>();

  if (!role) return <RoleSelector />;

  if (!["paciente", "profissional", "admin"].includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <LoginForm role={role as Role} />;
}
