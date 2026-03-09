import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, FileText, X, RefreshCw, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/layout/Layout";
import { Link } from "react-router-dom";

const mockAppointments = [
  { id: "a1", service: "Consulta de Medicina Geral", practitioner: "Dra. Ana Mendes", date: "2026-03-15", time: "09:30", unit: "Unidade Central", status: "upcoming" as const },
  { id: "a2", service: "Eletrocardiograma", practitioner: "Dr. Ricardo Silva", date: "2026-03-20", time: "14:00", unit: "Unidade Central", status: "upcoming" as const },
  { id: "a3", service: "Hemograma Completo", practitioner: "Lab.", date: "2026-02-10", time: "08:00", unit: "Laboratório", status: "completed" as const },
  { id: "a4", service: "Fisioterapia", practitioner: "Ft. João Ferreira", date: "2026-01-28", time: "10:00", unit: "Unidade de Fisioterapia", status: "cancelled" as const },
];

const statusLabels = {
  upcoming: { label: "Agendada", variant: "default" as const },
  completed: { label: "Realizada", variant: "secondary" as const },
  cancelled: { label: "Cancelada", variant: "destructive" as const },
};

export default function PatientDashboard() {
  const upcoming = mockAppointments.filter((a) => a.status === "upcoming");
  const past = mockAppointments.filter((a) => a.status !== "upcoming");

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Área do Paciente</h1>
            <p className="text-muted-foreground text-sm">Bem-vindo, João Silva</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1"><Settings className="w-4 h-4" /> Perfil</Button>
            <Button variant="outline" size="sm" className="gap-1 text-destructive"><LogOut className="w-4 h-4" /> Sair</Button>
          </div>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="history">Histórico ({past.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcoming.length === 0 ? (
              <div className="text-center py-16">
                <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold mb-1">Sem marcações</h3>
                <p className="text-sm text-muted-foreground">Não tem consultas agendadas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((apt, i) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="medical-card p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{apt.service}</h3>
                          <Badge>{statusLabels[apt.status].label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {apt.practitioner}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {apt.date}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {apt.time}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {apt.unit}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" className="gap-1"><RefreshCw className="w-3.5 h-3.5" /> Remarcar</Button>
                        <Button variant="outline" size="sm" className="gap-1 text-destructive"><X className="w-3.5 h-3.5" /> Cancelar</Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-3">
              {past.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="medical-card p-5 opacity-80"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{apt.service}</h3>
                        <Badge variant={statusLabels[apt.status].variant}>
                          {statusLabels[apt.status].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{apt.date} · {apt.time} · {apt.practitioner}</p>
                    </div>
                    <Button variant="ghost" size="sm"><FileText className="w-4 h-4" /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
