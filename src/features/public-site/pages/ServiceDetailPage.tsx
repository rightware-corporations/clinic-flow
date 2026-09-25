import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, AlertCircle, MapPin, FileText, ArrowLeft, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Layout from "@/features/public-site/components/Layout";
import { getServiceBySlug, categoryLabels, services } from "@/data/services";

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const service = getServiceBySlug(slug || "");

  if (!service) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h2 className="text-xl font-bold mb-2">Serviço não encontrado</h2>
          <Link to="/servicos" className="text-primary hover:underline text-sm">Voltar ao catálogo</Link>
        </div>
      </Layout>
    );
  }

  const related = services.filter((s) => s.category === service.category && s.id !== service.id).slice(0, 3);

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <Link to="/servicos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 space-y-6">
            <div>
              <Badge variant="secondary" className="mb-3">{categoryLabels[service.category]}</Badge>
              <h1 className="text-2xl md:text-3xl font-bold mb-4">{service.name}</h1>
              <p className="text-muted-foreground leading-relaxed">{service.longDescription}</p>
            </div>

            {/* Details grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {service.duration > 0 && (
                <div className="medical-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duração estimada</p>
                    <p className="font-semibold text-sm">{service.duration} minutos</p>
                  </div>
                </div>
              )}
              <div className="medical-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="font-semibold text-sm">{service.unit}</p>
                </div>
              </div>
            </div>

            {/* Preparation */}
            {service.requiresPreparation && service.preparationNotes && (
              <div className="medical-card p-5 border-warning/30 bg-warning/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-warning" />
                  <h3 className="font-semibold text-sm">Preparação necessária</h3>
                </div>
                <p className="text-sm text-muted-foreground">{service.preparationNotes}</p>
              </div>
            )}

            {/* Documents */}
            {service.requiredDocuments && service.requiredDocuments.length > 0 && (
              <div className="medical-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">Documentação necessária</h3>
                </div>
                <ul className="space-y-1.5">
                  {service.requiredDocuments.map((doc) => (
                    <li key={doc} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-primary" /> {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* FAQ */}
            <div>
              <h3 className="font-semibold mb-3">Perguntas frequentes</h3>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="q1" className="medical-card px-4 border rounded-xl">
                  <AccordionTrigger className="text-sm hover:no-underline py-3">Como me devo preparar?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-3">
                    {service.preparationNotes || "Não é necessária preparação especial. Traga a documentação indicada."}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="q2" className="medical-card px-4 border rounded-xl">
                  <AccordionTrigger className="text-sm hover:no-underline py-3">Posso cancelar a marcação?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-3">
                    Sim, pode cancelar até 24 horas antes sem custos.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Related */}
            {related.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Serviços relacionados</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {related.map((s) => (
                    <Link key={s.id} to={`/servicos/${s.slug}`} className="medical-card p-4 text-sm hover:border-primary/20">
                      <p className="font-medium mb-1">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} min · {s.unit}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Sidebar CTA */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="sticky top-24 medical-card p-6 space-y-4">
              <h3 className="font-semibold">{service.name}</h3>
              {service.price !== undefined && service.price > 0 && (
                <p className="text-2xl font-bold text-primary">{service.price}€</p>
              )}
              <div className="space-y-2 text-sm text-muted-foreground">
                {service.duration > 0 && <p>⏱ {service.duration} minutos</p>}
                <p>📍 {service.unit}</p>
              </div>
              <Link to={`/agendar?service=${service.id}`}>
                <Button className="w-full medical-gradient border-0 gap-2 h-11">
                  <CalendarDays className="w-5 h-5" /> Agendar Agora
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="sticky-cta-mobile">
        <Link to={`/agendar?service=${service.id}`}>
          <Button className="w-full medical-gradient border-0 gap-2 h-12 font-semibold">
            <CalendarDays className="w-5 h-5" /> Agendar {service.price && service.price > 0 ? `· ${service.price}€` : ""}
          </Button>
        </Link>
      </div>
    </Layout>
  );
}
