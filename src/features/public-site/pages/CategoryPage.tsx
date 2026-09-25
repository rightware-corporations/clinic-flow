import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Stethoscope, HeartPulse, ScanLine, TestTubes, Dumbbell, Shield,
  Home, Ambulance, Smile, Briefcase, Syringe, Clock, MapPin, ArrowLeft,
  ArrowRight, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout/Layout";
import {
  services, categoryLabels, type ServiceCategory,
} from "@/data/services";
import { getPractitionersByCategory, practitioners } from "@/data/practitioners";

const categoryIcons: Record<string, LucideIcon> = {
  consultas: Stethoscope, especialidades: HeartPulse, exames: ScanLine,
  analises: TestTubes, fisioterapia: Dumbbell, enfermagem: Syringe,
  vacinacao: Shield, domicilio: Home, ambulancia: Ambulance,
  dentaria: Smile, ocupacional: Briefcase,
};

const categoryDescriptions: Record<string, string> = {
  consultas: "Medicina geral e familiar, check-ups completos e orientação clínica personalizada para toda a família.",
  especialidades: "Mais de 15 áreas médicas incluindo cardiologia, dermatologia, ortopedia, neurologia e muito mais.",
  exames: "Eletrocardiograma, ecografia, raio-X e exames de diagnóstico avançados com tecnologia de última geração.",
  analises: "Hemograma, bioquímica, marcadores tumorais, perfis hormonais e análises de rotina com resultados rápidos.",
  fisioterapia: "Reabilitação física, terapia manual, recuperação pós-cirúrgica e programas de exercício personalizado.",
  enfermagem: "Tratamentos, pensos, administração de injetáveis e cuidados de enfermagem especializados.",
  vacinacao: "Vacinas do plano nacional, vacinas para viajantes, gripe sazonal e campanhas de imunização.",
  domicilio: "Enfermagem e cuidados médicos no conforto do seu lar, colheitas ao domicílio e acompanhamento continuado.",
  ambulancia: "Transporte medicalizado seguro e confortável para consultas, exames e transferências hospitalares.",
  dentaria: "Consultas dentárias, destartarização, restaurações, implantes, ortodontia e cirurgia oral.",
  ocupacional: "Exames de admissão, periódicos, fichas de aptidão e programas de saúde ocupacional para empresas.",
};

const categoryColors: Record<string, string> = {
  consultas: "bg-primary/10 text-primary",
  especialidades: "bg-destructive/10 text-destructive",
  exames: "bg-secondary/20 text-secondary",
  analises: "bg-accent/10 text-accent",
  fisioterapia: "bg-warning/10 text-warning",
  enfermagem: "bg-primary/10 text-primary",
  vacinacao: "bg-success/10 text-success",
  domicilio: "bg-secondary/20 text-secondary",
  ambulancia: "bg-destructive/10 text-destructive",
  dentaria: "bg-accent/10 text-accent",
  ocupacional: "bg-warning/10 text-warning",
};

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const category = slug as ServiceCategory;

  const label = categoryLabels[category];
  const Icon = categoryIcons[category];
  const description = categoryDescriptions[category];
  const color = categoryColors[category];

  if (!label || !Icon) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Categoria não encontrada</h1>
          <Link to="/servicos">
            <Button variant="outline">Ver todos os serviços</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const categoryServices = services.filter((s) => s.category === category);

  // Get practitioners for this category — also try matching by practitionerCategory
  const directPractitioners = getPractitionersByCategory(category);
  const extraPractitioners = practitioners.filter(
    (p) => !directPractitioners.includes(p) && categoryServices.some((s) => s.practitionerCategory === p.category)
  );
  const allPractitioners = [...directPractitioners, ...extraPractitioners];

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-muted/30">
        <div className="absolute inset-0 hero-gradient opacity-40" />
        <div className="container relative py-12 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/servicos"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao catálogo
            </Link>

            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center`}>
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground">{label}</h1>
                <p className="text-muted-foreground mt-1">{categoryServices.length} serviços disponíveis</p>
              </div>
            </div>
            <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">{description}</p>
          </motion.div>
        </div>
      </section>

      <div className="container py-10 lg:py-16 space-y-16">
        {/* Services */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-6">Serviços Disponíveis</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryServices.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                className="group relative bg-card border rounded-xl p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {svc.name}
                  </h3>
                  {svc.price && (
                    <Badge variant="secondary" className="shrink-0 ml-2">
                      {svc.price}€
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{svc.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{svc.duration} min</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{svc.unit}</span>
                </div>
                <div className="flex gap-2">
                  <Link to={`/servicos/${svc.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">Detalhes</Button>
                  </Link>
                  <Link to={`/agendar?service=${svc.id}`} className="flex-1">
                    <Button size="sm" className="w-full text-xs medical-gradient border-0">Agendar</Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Practitioners */}
        {allPractitioners.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Profissionais Qualificados</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allPractitioners.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                  className="bg-card border rounded-xl p-5 text-center hover:shadow-md transition-all"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-muted-foreground">
                      {doc.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">{doc.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.specialty}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" />{doc.unit}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doc.bio}</p>
                  <Link to={`/agendar`} className="mt-3 block">
                    <Button size="sm" className="w-full text-xs medical-gradient border-0">
                      Agendar <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="text-center bg-muted/30 rounded-2xl border p-8 lg:p-12">
          <h2 className="text-2xl font-bold text-foreground mb-2">Precisa de ajuda a escolher?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            A nossa equipa está disponível para ajudá-lo a encontrar o serviço mais adequado.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/agendar">
              <Button className="medical-gradient border-0 shadow-primary-glow">Agendar Agora</Button>
            </Link>
            <a href="tel:+351210000000">
              <Button variant="outline">Ligar: 210 000 000</Button>
            </a>
          </div>
        </section>
      </div>
    </Layout>
  );
}
