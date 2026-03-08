import { useState, useRef } from "react";
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
  Syringe,
  Menu,
  X,
  Phone,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MegaCategory {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  services: { name: string; href: string }[];
}

const megaCategories: MegaCategory[] = [
  {
    label: "Consultas",
    description: "Medicina geral e familiar, check-ups e orientação clínica personalizada.",
    href: "/categoria/consultas",
    icon: Stethoscope,
    color: "bg-primary/10 text-primary",
    services: [
      { name: "Medicina Geral", href: "/servicos/consulta-medicina-geral" },
      { name: "Pediatria", href: "/servicos?cat=consultas" },
      { name: "Geriatria", href: "/servicos?cat=consultas" },
    ],
  },
  {
    label: "Especialidades",
    description: "Cardiologia, dermatologia, ortopedia e mais de 15 áreas médicas.",
    href: "/categoria/especialidades",
    icon: HeartPulse,
    color: "bg-destructive/10 text-destructive",
    services: [
      { name: "Cardiologia", href: "/servicos/cardiologia" },
      { name: "Dermatologia", href: "/servicos/dermatologia" },
      { name: "Ortopedia", href: "/servicos?cat=especialidades" },
    ],
  },
  {
    label: "Exames",
    description: "Eletrocardiograma, ecografia, raio-X e exames de diagnóstico avançados.",
    href: "/categoria/exames",
    icon: ScanLine,
    color: "bg-secondary/20 text-secondary",
    services: [
      { name: "Eletrocardiograma", href: "/servicos/eletrocardiograma" },
      { name: "Ecografia Abdominal", href: "/servicos/ecografia-abdominal" },
      { name: "Raio-X", href: "/servicos?cat=exames" },
    ],
  },
  {
    label: "Análises",
    description: "Hemograma, bioquímica, marcadores tumorais e perfis hormonais.",
    href: "/categoria/analises",
    icon: TestTubes,
    color: "bg-accent/10 text-accent",
    services: [
      { name: "Hemograma Completo", href: "/servicos/hemograma-completo" },
      { name: "Bioquímica", href: "/servicos?cat=analises" },
      { name: "Marcadores", href: "/servicos?cat=analises" },
    ],
  },
  {
    label: "Fisioterapia",
    description: "Reabilitação física, terapia manual e recuperação pós-cirúrgica.",
    href: "/categoria/fisioterapia",
    icon: Dumbbell,
    color: "bg-warning/10 text-warning",
    services: [
      { name: "Sessão Individual", href: "/servicos/fisioterapia-sessao" },
      { name: "Reabilitação", href: "/servicos?cat=fisioterapia" },
    ],
  },
  {
    label: "Vacinação",
    description: "Vacinas do plano nacional, viajantes e gripe sazonal.",
    href: "/categoria/vacinacao",
    icon: Shield,
    color: "bg-success/10 text-success",
    services: [
      { name: "COVID-19", href: "/servicos/vacinacao-covid" },
      { name: "Gripe", href: "/servicos?cat=vacinacao" },
    ],
  },
  {
    label: "Enfermagem",
    description: "Tratamentos, pensos, administração de injetáveis e cuidados de enfermagem.",
    href: "/servicos?cat=enfermagem",
    icon: Syringe,
    color: "bg-primary/10 text-primary",
    services: [
      { name: "Tratamentos", href: "/servicos?cat=enfermagem" },
      { name: "Injetáveis", href: "/servicos?cat=enfermagem" },
    ],
  },
  {
    label: "Domicílio",
    description: "Enfermagem e cuidados médicos no conforto do seu lar.",
    href: "/servicos?cat=domicilio",
    icon: Home,
    color: "bg-secondary/20 text-secondary",
    services: [
      { name: "Enfermagem Domiciliária", href: "/servicos/enfermagem-domicilio" },
      { name: "Colheitas", href: "/servicos?cat=domicilio" },
    ],
  },
  {
    label: "Ambulância",
    description: "Transporte medicalizado seguro para consultas e exames.",
    href: "/servicos?cat=ambulancia",
    icon: Ambulance,
    color: "bg-destructive/10 text-destructive",
    services: [
      { name: "Transporte", href: "/servicos/ambulancia" },
    ],
  },
  {
    label: "Dentária",
    description: "Consultas, destartarização, restaurações e cirurgia oral.",
    href: "/servicos?cat=dentaria",
    icon: Smile,
    color: "bg-accent/10 text-accent",
    services: [
      { name: "Consulta Dentária", href: "/servicos/medicina-dentaria" },
      { name: "Implantes", href: "/servicos?cat=dentaria" },
    ],
  },
  {
    label: "Ocupacional",
    description: "Exames de admissão, periódicos e fichas de aptidão para empresas.",
    href: "/servicos?cat=ocupacional",
    icon: Briefcase,
    color: "bg-warning/10 text-warning",
    services: [
      { name: "Medicina do Trabalho", href: "/servicos/medicina-trabalho" },
    ],
  },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleMouseEnter = () => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setServicesOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeout.current = setTimeout(() => setServicesOpen(false), 150);
  };

  const active = megaCategories[activeCategory];

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
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                location.pathname.startsWith("/servicos")
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Serviços <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {servicesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[780px] bg-card rounded-2xl border shadow-elevated overflow-hidden"
                >
                  <div className="flex">
                    {/* Left column: category list */}
                    <div className="w-[260px] border-r bg-muted/30 py-2 max-h-[440px] overflow-y-auto">
                      {megaCategories.map((cat, i) => (
                        <button
                          key={cat.label}
                          onMouseEnter={() => setActiveCategory(i)}
                          onClick={() => {
                            setServicesOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-150 ${
                            activeCategory === i
                              ? "bg-background text-foreground font-medium shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg ${cat.color} flex items-center justify-center shrink-0`}>
                            <cat.icon className="w-4 h-4" />
                          </div>
                          <span>{cat.label}</span>
                          <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-opacity ${activeCategory === i ? "opacity-100" : "opacity-0"}`} />
                        </button>
                      ))}
                    </div>

                    {/* Right column: active category detail */}
                    <div className="flex-1 p-6">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={active.label}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-11 h-11 rounded-xl ${active.color} flex items-center justify-center`}>
                              <active.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{active.label}</h3>
                              <p className="text-xs text-muted-foreground">{active.description}</p>
                            </div>
                          </div>

                          <div className="mt-5 space-y-1">
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Serviços populares</p>
                            {active.services.map((svc) => (
                              <Link
                                key={svc.name}
                                to={svc.href}
                                onClick={() => setServicesOpen(false)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                {svc.name}
                              </Link>
                            ))}
                          </div>

                          <div className="mt-6 pt-4 border-t">
                            <Link
                              to={active.href}
                              onClick={() => setServicesOpen(false)}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                            >
                              Ver todos de {active.label} <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t bg-muted/20 px-6 py-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">11 categorias · 50+ serviços disponíveis</span>
                    <Link
                      to="/servicos"
                      onClick={() => setServicesOpen(false)}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      Explorar catálogo completo <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
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
            <div className="container py-4 space-y-1">
              <Link to="/" className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Início</Link>
              
              {/* Mobile services accordion */}
              <div className="space-y-1">
                <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Serviços</p>
                <div className="grid grid-cols-2 gap-1">
                  {megaCategories.map((cat) => (
                    <Link
                      key={cat.label}
                      to={cat.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-md ${cat.color} flex items-center justify-center shrink-0`}>
                        <cat.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-foreground">{cat.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <Link to="/sobre" className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Sobre</Link>
              <Link to="/contacto" className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Contacto</Link>
              <Link to="/login" className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/50" onClick={() => setMobileOpen(false)}>Área Pessoal</Link>
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
