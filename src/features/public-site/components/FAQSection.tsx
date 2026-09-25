import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "Como posso agendar uma consulta?", a: "Pode agendar online através do nosso sistema de marcações, por telefone (210 000 000) ou presencialmente na nossa receção." },
  { q: "Quais os documentos necessários?", a: "Para a primeira consulta, traga o Cartão de Cidadão e Cartão de Utente do SNS. Para exames, poderá ser necessário uma requisição médica." },
  { q: "Posso cancelar ou remarcar?", a: "Sim, pode cancelar ou remarcar até 24 horas antes da consulta sem custos, através da sua área pessoal ou por telefone." },
  { q: "Aceitam seguros de saúde?", a: "Trabalhamos com as principais seguradoras e subsistemas de saúde. Contacte-nos para confirmar a sua cobertura." },
  { q: "Qual o horário de funcionamento?", a: "Estamos abertos de Segunda a Sexta das 8h às 20h e Sábados das 8h às 14h. O serviço de ambulância funciona 24/7." },
  { q: "Fazem serviços ao domicílio?", a: "Sim, dispomos de serviço de enfermagem e colheitas ao domicílio. Pode agendar diretamente na plataforma." },
];

export default function FAQSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Perguntas frequentes</h2>
          <p className="text-muted-foreground">Respostas às dúvidas mais comuns dos nossos pacientes.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="medical-card px-5 border rounded-xl"
              >
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
