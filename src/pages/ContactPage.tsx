import { useState } from "react";
import Layout from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Clock, Send, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const contactInfo = [
  { icon: Phone, label: "Telefone", value: "210 000 000", href: "tel:+351210000000", desc: "Seg–Sex: 8h–20h | Sáb: 9h–14h" },
  { icon: Mail, label: "Email", value: "geral@medclinica.pt", href: "mailto:geral@medclinica.pt", desc: "Respondemos em 24h úteis" },
  { icon: MapPin, label: "Morada", value: "Av. da Liberdade, 100", href: "https://maps.google.com/?q=Av.+da+Liberdade+100+Lisboa", desc: "1250-096 Lisboa, Portugal" },
  { icon: Clock, label: "Horário", value: "Seg–Sex: 8h–20h", href: null, desc: "Sábados: 9h–14h | Domingos: Encerrado" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ContactPage() {
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    // Simulated send
    setTimeout(() => {
      setSending(false);
      toast.success("Mensagem enviada com sucesso! Entraremos em contacto brevemente.");
      (e.target as HTMLFormElement).reset();
    }, 1200);
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-accent/5 py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <MessageSquare className="w-4 h-4" />
              Contacte-nos
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6">
              Estamos aqui para <span className="text-primary">ajudar</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Tem dúvidas ou precisa de informações? A nossa equipa está disponível
              para o ajudar através dos canais abaixo.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-12 border-b bg-card">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow text-center">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:text-primary transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="font-semibold text-foreground">{item.value}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form + Map */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">Envie-nos uma mensagem</CardTitle>
                  <p className="text-sm text-muted-foreground">Preencha o formulário e responderemos o mais breve possível.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome completo</Label>
                        <Input id="name" placeholder="O seu nome" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="email@exemplo.pt" required />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input id="phone" type="tel" placeholder="912 345 678" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Assunto</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">Informações gerais</SelectItem>
                            <SelectItem value="booking">Marcações</SelectItem>
                            <SelectItem value="results">Resultados / Relatórios</SelectItem>
                            <SelectItem value="complaint">Reclamação</SelectItem>
                            <SelectItem value="partnership">Parcerias</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Mensagem</Label>
                      <Textarea id="message" placeholder="Escreva a sua mensagem..." rows={5} required />
                    </div>
                    <Button type="submit" className="w-full medical-gradient border-0" disabled={sending}>
                      {sending ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          A enviar...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" /> Enviar Mensagem
                        </span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Map */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <div className="h-full min-h-[400px] rounded-2xl overflow-hidden border shadow-sm">
                <iframe
                  title="Localização MED Clinica"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3113.2!2d-9.1466!3d38.7223!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd19347a1a0a0a0a%3A0x0!2sAv.+da+Liberdade%2C+Lisboa!5e0!3m2!1spt-PT!2spt!4v1"
                  className="w-full h-full"
                  style={{ border: 0, minHeight: 400 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
