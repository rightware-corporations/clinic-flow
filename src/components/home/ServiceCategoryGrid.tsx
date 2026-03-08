import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Stethoscope,
  HeartPulse,
  ScanLine,
  TestTubes,
  Dumbbell,
  Syringe,
  Shield,
  Home,
  Ambulance,
  Smile,
  Briefcase,
  ArrowRight,
} from "lucide-react";

const categories = [
  { label: "Consultas", icon: Stethoscope, href: "/servicos?cat=consultas", color: "bg-primary/10 text-primary" },
  { label: "Especialidades", icon: HeartPulse, href: "/servicos?cat=especialidades", color: "bg-destructive/10 text-destructive" },
  { label: "Exames", icon: ScanLine, href: "/servicos?cat=exames", color: "bg-secondary/20 text-secondary" },
  { label: "Análises", icon: TestTubes, href: "/servicos?cat=analises", color: "bg-accent/10 text-accent" },
  { label: "Fisioterapia", icon: Dumbbell, href: "/servicos?cat=fisioterapia", color: "bg-warning/10 text-warning" },
  { label: "Enfermagem", icon: Syringe, href: "/servicos?cat=enfermagem", color: "bg-primary/10 text-primary" },
  { label: "Vacinação", icon: Shield, href: "/servicos?cat=vacinacao", color: "bg-success/10 text-success" },
  { label: "Domicílio", icon: Home, href: "/servicos?cat=domicilio", color: "bg-secondary/20 text-secondary" },
  { label: "Ambulância", icon: Ambulance, href: "/servicos?cat=ambulancia", color: "bg-destructive/10 text-destructive" },
  { label: "Dentária", icon: Smile, href: "/servicos?cat=dentaria", color: "bg-accent/10 text-accent" },
  { label: "Ocupacional", icon: Briefcase, href: "/servicos?cat=ocupacional", color: "bg-warning/10 text-warning" },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function ServiceCategoryGrid() {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Os nossos serviços</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Uma oferta completa de cuidados de saúde para toda a família.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4"
        >
          {categories.map((cat) => (
            <motion.div key={cat.label} variants={cardVariants}>
              <Link
                to={cat.href}
                className="medical-card flex flex-col items-center gap-3 p-5 text-center group"
              >
                <motion.div
                  whileHover={{ scale: 1.15, rotate: 3 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center`}
                >
                  <cat.icon className="w-5 h-5" />
                </motion.div>
                <span className="text-sm font-medium text-foreground">{cat.label}</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <Link
            to="/servicos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ver todos os serviços <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
