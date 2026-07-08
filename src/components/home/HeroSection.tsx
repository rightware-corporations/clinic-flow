import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { CalendarDays, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-clinic.jpg";
import { useRef } from "react";

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.5], [0.85, 0.95]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const statsVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.12, delayChildren: 0.6 },
    },
  };

  const statItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Parallax background */}
      <motion.div className="absolute inset-0" style={{ y: imageY, scale: imageScale }}>
        <img src={heroImage} alt="MED Clinica" className="w-full h-full object-cover" />
      </motion.div>
      <motion.div className="absolute inset-0 hero-gradient" style={{ opacity: overlayOpacity }} />

      <motion.div className="relative container py-20 md:py-32 lg:py-40" style={{ y: contentY }}>
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/15 text-primary-foreground/90 text-xs font-medium backdrop-blur-sm border border-primary-foreground/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Aberto de Segunda a Sábado
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-[1.1] mb-5"
          >
            A sua saúde,{" "}
            <motion.span
              className="text-accent-foreground/90 inline-block"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4, type: "spring", stiffness: 120 }}
            >
              a nossa prioridade
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base md:text-lg text-primary-foreground/75 leading-relaxed mb-8 max-w-xl"
          >
            Consultas, exames, análises, fisioterapia e muito mais. Agende online em segundos
            com a melhor equipa médica.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link to="/agendar">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg gap-2 h-12 px-7 font-semibold">
                  <CalendarDays className="w-5 h-5" />
                  Marcar Consulta
                </Button>
              </motion.div>
            </Link>
            <Link to="/servicos">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-12 px-7">
                  <Search className="w-5 h-5" />
                  Ver Serviços
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Staggered Stats */}
          <motion.div
            variants={statsVariants}
            initial="hidden"
            animate="show"
            className="mt-12 flex items-center gap-8 md:gap-12"
          >
            {[
              { num: "15+", label: "Especialidades" },
              { num: "30+", label: "Profissionais" },
              { num: "50k+", label: "Pacientes" },
            ].map((stat) => (
              <motion.div key={stat.label} variants={statItem}>
                <div className="text-2xl md:text-3xl font-bold text-primary-foreground">{stat.num}</div>
                <div className="text-xs text-primary-foreground/60">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
