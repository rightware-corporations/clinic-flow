import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CTASection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="medical-gradient rounded-2xl p-8 md:p-16 text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
            Cuide da sua saúde hoje
          </h2>
          <p className="text-primary-foreground/75 max-w-md mx-auto mb-8">
            Agende a sua consulta ou exame em poucos passos. A nossa equipa está pronta para o receber.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/agendar">
              <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 gap-2 h-12 px-7 font-semibold">
                <CalendarDays className="w-5 h-5" />
                Agendar Online
              </Button>
            </Link>
            <a href="tel:+351210000000">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2 h-12 px-7">
                <Phone className="w-5 h-5" />
                Ligar Agora
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
