import Layout from "@/components/layout/Layout";
import { motion } from "framer-motion";
import {
  Stethoscope,
  Award,
  Users,
  Clock,
  ShieldCheck,
  Heart,
  Building2,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const values = [
  { icon: Heart, title: "Cuidado Humanizado", desc: "Cada paciente é único. Tratamos pessoas, não apenas sintomas." },
  { icon: ShieldCheck, title: "Excelência Clínica", desc: "Protocolos rigorosos e profissionais altamente qualificados." },
  { icon: Users, title: "Equipa Multidisciplinar", desc: "Mais de 30 especialistas a trabalhar em conjunto pelo seu bem-estar." },
  { icon: Clock, title: "Disponibilidade", desc: "Horários alargados e atendimento ao domicílio para sua conveniência." },
];

const stats = [
  { value: "15+", label: "Anos de Experiência" },
  { value: "30+", label: "Profissionais" },
  { value: "50+", label: "Serviços" },
  { value: "10k+", label: "Pacientes Atendidos" },
];

const team = [
  { name: "Dra. Maria Santos", role: "Diretora Clínica", specialty: "Medicina Interna" },
  { name: "Dr. João Ferreira", role: "Coordenador Médico", specialty: "Cardiologia" },
  { name: "Dra. Ana Costa", role: "Responsável Enfermagem", specialty: "Enfermagem Avançada" },
  { name: "Dr. Pedro Oliveira", role: "Fisioterapia", specialty: "Reabilitação Desportiva" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function AboutPage() {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Building2 className="w-4 h-4" />
              Sobre a MedClínica
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
              Cuidar com <span className="text-primary">excelência</span> é a nossa missão
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Desde 2010, a MedClínica é referência em cuidados de saúde premium em Lisboa.
              Combinamos tecnologia de ponta com um atendimento humano e personalizado.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b bg-card">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl lg:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Missão</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Proporcionar cuidados de saúde de excelência, acessíveis e centrados no paciente,
                utilizando as melhores práticas clínicas e tecnologia avançada para promover
                o bem-estar e a qualidade de vida da comunidade que servimos.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Award className="w-5 h-5 text-secondary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Visão</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Ser a clínica de referência em Portugal pela inovação nos cuidados de saúde,
                reconhecida pela excelência clínica, satisfação dos pacientes e
                contribuição positiva para a saúde pública.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 lg:py-24 bg-muted/30">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-3">Os nossos valores</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Princípios que guiam cada decisão e cada interação na MedClínica.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <v.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{v.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-3">Equipa de Direção</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Líderes experientes comprometidos com a qualidade dos cuidados prestados.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="text-center border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Stethoscope className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <p className="text-sm text-primary font-medium">{member.role}</p>
                    <p className="text-xs text-muted-foreground mt-1">{member.specialty}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
