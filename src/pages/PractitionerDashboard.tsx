import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, User, Ban, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/layout/Layout";

const mockAgenda = [
  { id: "b1", patient: "João Silva", service: "Consulta de Medicina Geral", time: "09:30", duration: 30, status: "confirmed" as const },
  { id: "b2", patient: "Maria Santos", service: "Consulta de Medicina Geral", time: "10:00", duration: 30, status: "confirmed" as const },
  { id: "b3", patient: "Pedro Costa", service: "Consulta de Medicina Geral", time: "10:30", duration: 30, status: "pending" as const },
  { id: "b4", patient: "--", service: "Bloqueado", time: "11:00", duration: 30, status: "blocked" as const },
  { id: "b5", patient: "Ana Ferreira", service: "Consulta de Medicina Geral", time: "11:30", duration: 30, status: "confirmed" as const },
  { id: "b6", patient: "Carlos Oliveira", service: "Consulta de Medicina Geral", time: "14:00", duration: 30, status: "confirmed" as const },
];

const statusConfig = {
  confirmed: { label: "Confirmada", color: "bg-success/10 text-success" },
  pending: { label: "Pendente", color: "bg-warning/10 text-warning" },
  blocked: { label: "Bloqueado", color: "bg-muted text-muted-foreground" },
  completed: { label: "Realizada", color: "bg-primary/10 text-primary" },
};

export default function PractitionerDashboard() {
  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Agenda Profissional</h1>
            <p className="text-muted-foreground text-sm">Dra. Ana Mendes · Medicina Geral</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1"><Ban className="w-4 h-4" /> Bloquear Horário</Button>
          </div>
        </div>

        <Tabs defaultValue="today" className="space-y-6">
          <TabsList>
            <TabsTrigger value="today">Hoje ({mockAgenda.length})</TabsTrigger>
            <TabsTrigger value="week">Semanal</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <div className="space-y-2">
              {mockAgenda.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`medical-card p-4 flex items-center justify-between ${apt.status === "blocked" ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[48px]">
                      <p className="text-lg font-bold text-primary">{apt.time}</p>
                      <p className="text-[10px] text-muted-foreground">{apt.duration}min</p>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{apt.patient}</p>
                      <p className="text-xs text-muted-foreground">{apt.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig[apt.status].color}`}>
                      {statusConfig[apt.status].label}
                    </span>
                    {apt.status !== "blocked" && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Check className="w-4 h-4 text-success" /></Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="week">
            <div className="text-center py-16">
              <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Vista semanal</h3>
              <p className="text-sm text-muted-foreground">Vista semanal disponível em breve.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
