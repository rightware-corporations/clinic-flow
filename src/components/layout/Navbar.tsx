import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  HeartPulse,
  ScanLine,
  TestTubes,
  Dumbbell,
  Shield,
  Home,
  Ambulance,
  Smile,
  Briefcase,
  Menu,
  X,
  Phone,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const serviceLinks = [
  { label: "Consultas", href: "/servicos?cat=consultas", icon: Stethoscope },
  { label: "Especialidades", href: "/servicos?cat=especialidades", icon: HeartPulse },
  { label: "Exames", href: "/servicos?cat=exames", icon: ScanLine },
  { label: "Análises", href: "/servicos?cat=analises", icon: TestTubes },
  { label: "Fisioterapia", href: "/servicos?cat=fisioterapia", icon: Dumbbell },
  { label: "Vacinação", href: "/servicos?cat=vacinacao", icon: Shield },
  { label: "Domicílio", href: "/servicos?cat=domicilio", icon: Home },
  { label: "Ambulância", href: "/servicos?cat=ambulancia", icon: Ambulance },
  { label: "Dentária", href: "/servicos?cat=dentaria", icon: Smile },
  { label: "Ocupacional", href: "/servicos?cat=ocupacional", icon: Briefcase },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg medical-gradient flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight text-foreground tracking-tight">MedClínica</span>
            <span className="text-[10px] text-muted-foreground leading-none tracking-wider uppercase">Premium Healthcare</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive("/") ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Início
          </Link>

          {/* Services Mega Menu */}
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                location.pathname.startsWith("/servicos")
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Serviços <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
              {servicesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[480px] bg-card rounded-xl border shadow-elevated p-4 grid grid-cols-2 gap-1"
                >
                  {serviceLinks.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      onClick={() => setServicesOpen(false)}
                    >
                      <item.icon className="w-4 h-4 text-primary" />
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    to="/servicos"
                    className="col-span-2 mt-2 pt-3 border-t text-center text-sm font-medium text-primary hover:underline"
                    onClick={() => setServicesOpen(false)}
                  >
                    Ver todos os serviços →
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            to="/sobre"
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Sobre
          </Link>
          <Link
            to="/contacto"
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            Contacto
          </Link>
        </nav>

        {/* Desktop Right */}
        <div className="hidden lg:flex items-center gap-3">
          <a href="tel:+351210000000" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Phone className="w-4 h-4" />
            <span>210 000 000</span>
          </a>
          <Link to="/login">
            <Button variant="outline" size="sm">
              Área Pessoal
            </Button>
          </Link>
          <Link to="/agendar">
            <Button size="sm" className="medical-gradient border-0 shadow-primary-glow">
              Agendar
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden overflow-hidden border-t bg-card"
          >
            <div className="container py-4 space-y-2">
              <Link to="/" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Início</Link>
              <Link to="/servicos" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Serviços</Link>
              <Link to="/sobre" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Sobre</Link>
              <Link to="/contacto" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Contacto</Link>
              <Link to="/login" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Área Pessoal</Link>
              <div className="pt-2">
                <Link to="/agendar" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full medical-gradient border-0">Agendar Consulta</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
