/**
 * StaffDashboard — Staff/Funcionário dashboard
 * 
 * Focus: appointment coordination, patient lookup, daily operations
 * Access: S### IDs
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Users,
  Clock,
  Phone,
  Search,
  CheckCircle2,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import { getPatients } from "@/data/medical-reports-store";

const todayAppointments = [
  { id: "1", patient: "João Silva", patientId: "C001", doctor: "Dra. Ana Mendes", time: "09:30", service: "Medicina Geral", status: "checked_in" as const },
  { id: "2", patient: "Maria Santos", patientId: "C002", doctor: "Dra. Ana Mendes", time: "10:00", service: "Medicina Geral", status: "waiting" as const },
  { id: "3", patient: "Pedro Costa", patientId: "C003", doctor: "Dr. Ricardo Silva", time: "10:30", service: "Cardiologia", status: "scheduled" as const },
  { id: "4", patient: "Ana Ferreira", patientId: "C004", doctor: "Dra. Ana Mendes", time: "11:30", service: "Medicina Geral", status: "scheduled" as const },
  { id: "5", patient: "Carlos Oliveira", patientId: "C005", doctor: "Dra. Sofia Marques", time: "14:00", service: "Dermatologia", status: "scheduled" as const },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Agendado", color: "bg-muted text-muted-foreground" },
  waiting: { label: "Na sala de espera", color: "bg-warning/10 text-warning" },
  checked_in: { label: "Check-in feito", color: "bg-primary/10 text-primary" },
  in_consultation: { label: "Em consulta", color: "bg-accent/10 text-accent" },
  completed: { label: "Concluído", color: "bg-success/10 text-success" },
};

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const patients = getPatients();

  const filteredPatients = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return patients.filter((p) =>
      p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.phone.includes(q)
    );
  }, [patients, search]);

  const stats = [
    { label: "Consultas Hoje", value: todayAppointments.length, icon: Calendar },
    { label: "Aguardando", value: todayAppointments.filter((a) => a.status === "waiting").length, icon: Clock },
    { label: "Check-in", value: todayAppointments.filter((a) => a.status === "checked_in").length, icon: CheckCircle2 },
    { label: "Pacientes Registados", value: patients.length, icon: Users },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Staff</h1>
          <p className="text-sm text-muted-foreground">Gestão de recepção e coordenação</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <stat.icon className="w-4 h-4" />
                    {stat.label}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="appointments">Consultas de Hoje</TabsTrigger>
            <TabsTrigger value="patients">Pesquisa de Pacientes</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <div className="space-y-3">
              {todayAppointments.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="hover:border-primary/20 transition-colors">
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-bold text-primary">{apt.time}</p>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{apt.patient}</p>
                          <p className="text-xs text-muted-foreground">{apt.service} · {apt.doctor}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${statusLabels[apt.status].color}`}>
                          {statusLabels[apt.status].label}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/pacientes/${apt.patientId}`)}>
                          Ver perfil
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="patients">
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Pesquisar paciente (nome, ID, telefone)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              {search && filteredPatients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum paciente encontrado</p>
                </div>
              )}
              <div className="space-y-2">
                {filteredPatients.map((p) => (
                  <Card key={p.id} className="cursor-pointer hover:border-primary/20 transition-colors" onClick={() => navigate(`/pacientes/${p.id}`)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.id} · {p.phone}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">Ver perfil</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
