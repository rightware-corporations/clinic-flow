import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Save, LogOut, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; id?: string; email?: string; role: string } | null>(null);
  const [name, setName] = useState("");
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
        setName(parsed.name || "");
      } catch (e) {
        navigate("/login");
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      if (user) {
        const updatedUser = { ...user, name };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        window.dispatchEvent(new Event("auth-change"));
        setUser(updatedUser);
        toast.success("Perfil atualizado com sucesso!");
      }
      setIsSaving(false);
    }, 600);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    toast.success("Sessão terminada com sucesso");
    navigate("/");
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case "admin": return "Administrador";
      case "profissional": return "Profissional de Saúde";
      default: return "Paciente";
    }
  };

  if (!user) return null;

  const dashboardPath = user.role === "admin" ? "/admin" : user.role === "profissional" ? "/profissional" : "/paciente";

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-2xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground gap-1" onClick={() => navigate(dashboardPath)}>
          <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">O Meu Perfil</h1>
            <p className="text-muted-foreground text-sm">Gerir os seus dados pessoais</p>
          </div>
          <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive gap-2" onClick={() => setLogoutDialogOpen(true)}>
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Terminar Sessão</span>
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-8 pb-8 border-b">
            <div className="w-20 h-20 rounded-full medical-gradient flex items-center justify-center text-primary-foreground text-2xl font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold">{name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Shield className="w-3 h-3" />
                  {getRoleLabel(user.role)}
                </span>
                <span className="text-sm text-muted-foreground font-mono">{user.id || user.email || "—"}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="pl-10" 
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-id">ID de Utilizador</Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="user-id" 
                    value={user.id || "—"} 
                    disabled 
                    className="pl-10 bg-muted/50 text-muted-foreground cursor-not-allowed font-mono uppercase" 
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">O ID não pode ser alterado.</p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" className="gap-2" disabled={isSaving || name === user.name}>
                <Save className="w-4 h-4" /> {isSaving ? "A guardar..." : "Guardar Alterações"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que pretende sair da sua conta? Terá de fazer login novamente para aceder ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair da Conta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}