import { motion } from "framer-motion";
import { ShieldCheck, Users, Clock, Award } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Confiança", desc: "Mais de 15 anos ao serviço da comunidade." },
  { icon: Users, title: "Equipa experiente", desc: "30+ profissionais especializados." },
  { icon: Clock, title: "Horário alargado", desc: "Aberto de Segunda a Sábado, das 8h às 20h." },
  { icon: Award, title: "Certificação", desc: "Clínica certificada com padrões europeus." },
];

export default function AboutSection() {
  return (
    <section className="py-16 md:py-24 surface-gradient">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Sobre a MedClínica</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              A MedClínica é uma unidade de saúde multidisciplinar dedicada a oferecer cuidados
              médicos de excelência. Com instalações modernas e uma equipa altamente qualificada,
              proporcionamos um atendimento humanizado e personalizado a cada paciente.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Desde consultas de medicina geral a exames especializados, oferecemos uma gama completa
              de serviços de saúde, incluindo fisioterapia, vacinação, serviços ao domicílio e
              transporte em ambulância.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="medical-card p-5"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <feat.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{feat.title}</h3>
                <p className="text-xs text-muted-foreground">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
