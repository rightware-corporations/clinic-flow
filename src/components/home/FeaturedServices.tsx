import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFeaturedServices } from "@/data/services";

export default function FeaturedServices() {
  const featured = getFeaturedServices().slice(0, 6);

  return (
    <section className="py-16 md:py-24 surface-gradient">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Serviços em destaque</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Os serviços mais procurados pelos nossos pacientes.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <div className="medical-card overflow-hidden h-full flex flex-col">
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-foreground leading-snug">{service.name}</h3>
                    {service.price !== undefined && service.price > 0 && (
                      <span className="shrink-0 text-sm font-bold text-primary">{service.price}€</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                    {service.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {service.duration} min
                    </span>
                    {service.requiresPreparation && (
                      <span className="flex items-center gap-1 text-warning">
                        <AlertCircle className="w-3.5 h-3.5" /> Prep. necessária
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/servicos/${service.slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Detalhes
                      </Button>
                    </Link>
                    <Link to={`/agendar?service=${service.id}`} className="flex-1">
                      <Button size="sm" className="w-full medical-gradient border-0">
                        Agendar
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
