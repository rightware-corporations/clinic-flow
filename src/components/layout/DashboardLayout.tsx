/**
 * DashboardLayout — Sidebar layout for authenticated internal pages
 * 
 * Provides consistent sidebar navigation based on user role.
 * Each role sees different menu items based on their permissions.
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Settings,
  LogOut,
  User,
  ClipboardList,
  Building2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "sonner";
import { logout as serverLogout } from "@/lib/clinicflow-api";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

// Menu items per role
function getMenuItems(role: string): NavItem[] {
  const common: NavItem[] = [
    { label: "Perfil", href: "/perfil", icon: User },
  ];

  switch (role) {
    case "admin":
      return [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { label: "Pacientes", href: "/pacientes", icon: Users },
        { label: "Profissionais", href: "/profissionais", icon: Building2 },
        { label: "Equipa & Convites", href: "/equipa", icon: Users },

        { label: "Agendamentos", href: "/marcacoes", icon: Calendar },
        ...common,
      ];
    case "profissional":
      return [
        { label: "Dashboard", href: "/profissional", icon: LayoutDashboard },
        { label: "Agenda real", href: "/marcacoes", icon: Calendar },
        { label: "Relatórios", href: "/relatorios", icon: FileText },
        ...common,
      ];
    case "staff":
      return [
        { label: "Dashboard", href: "/staff", icon: LayoutDashboard },
        { label: "Pacientes", href: "/pacientes", icon: Users },
        { label: "Agendamentos", href: "/marcacoes", icon: Calendar },
        ...common,
      ];
    case "interno":
      return [
        { label: "Dashboard", href: "/interno", icon: LayoutDashboard },

        ...common,
      ];
    case "paciente":
      return [
        { label: "Dashboard", href: "/paciente", icon: LayoutDashboard },
        { label: "Simular agendamento", href: "/agendar", icon: Calendar },
        ...common,
      ];
    default:
      return common;
  }
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: "Administrador",
    profissional: "Médico",
    staff: "Funcionário",
    interno: "Interno",
    paciente: "Paciente",
  };
  return labels[role] || role;
}

function getRoleBadgeClass(role: string): string {
  const classes: Record<string, string> = {
    admin: "bg-destructive/10 text-destructive",
    profissional: "bg-primary/10 text-primary",
    staff: "bg-secondary/10 text-secondary",
    interno: "bg-warning/10 text-warning",
    paciente: "bg-accent/10 text-accent",
  };
  return classes[role] || "bg-muted text-muted-foreground";
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);

  useEffect(() => {
    const checkUser = () => {
      const userStr = localStorage.getItem("user");
      setUser(userStr ? JSON.parse(userStr) : null);
    };
    checkUser();
    window.addEventListener("auth-change", checkUser);
    return () => window.removeEventListener("auth-change", checkUser);
  }, []);

  const handleLogout = async () => {
    try {
      await serverLogout();
      localStorage.removeItem("user");
      sessionStorage.removeItem("clinicflow:tenant");
      window.dispatchEvent(new Event("auth-change"));
      toast.success("Sessão terminada");
      navigate("/");
      setLogoutOpen(false);
    } catch {
      toast.error("Não foi possível terminar a sessão. Tente novamente.");
    }
  };

  if (!user) return <>{children}</>;

  const menuItems = getMenuItems(user.role);
  const isActive = (href: string) => location.pathname === href;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <img src="/med-clinica-mark.svg" alt="MED Clinica" className="w-9 h-9 rounded-lg object-contain shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground truncate">MED Clinica</p>
            <p className="text-[10px] text-muted-foreground">Sistema de Gestão</p>
          </div>
        )}
      </div>

      <Separator />

      {/* User info */}
      <div className="p-4">
        {collapsed ? (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center mx-auto">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs font-mono text-muted-foreground">{user.id}</p>
            <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full font-medium", getRoleBadgeClass(user.role))}>
              {getRoleLabel(user.role)}
            </span>
          </div>
        )}
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.href}
            onClick={() => { navigate(item.href); setMobileOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <Separator />

      {/* Logout */}
      <div className="p-2">
        <button
          onClick={() => setLogoutOpen(true)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}>
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t border-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile header + sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/med-clinica-mark.svg" alt="MED Clinica" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-bold text-sm">MED Clinica</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-14 bottom-0 z-50 w-64 bg-card border-r border-border overflow-y-auto">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 md:overflow-y-auto">
        <div className="md:hidden h-14" /> {/* spacer for mobile header */}
        {children}
      </main>

      {/* Logout dialog */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminar sessão?</AlertDialogTitle>
            <AlertDialogDescription>Será redirecionado para a página inicial.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
