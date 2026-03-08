import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

  return (
    <div className="min-h-screen flex">
      {/* Left visual panel — desktop */}
      <div className="hidden lg:flex lg:w-[45%] hero-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        </div>
        <div className="max-w-md text-center relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mx-auto mb-8 backdrop-blur-sm border border-primary-foreground/10">
            <Stethoscope className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-3">MedClínica</h2>
          <p className="text-sm uppercase tracking-widest text-primary-foreground/50 mb-6">Premium Healthcare</p>
          <p className="text-primary-foreground/70 leading-relaxed">
            Aceda à sua área pessoal para gerir marcações, consultar histórico e muito mais.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-[400px]">
          {/* Logo — mobile only */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl medical-gradient flex items-center justify-center mb-3">
              <Stethoscope className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">MedClínica</h1>
            <p className="text-xs text-muted-foreground">Premium Healthcare</p>
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
