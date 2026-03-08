import { motion } from "framer-motion";
import { Users, CalendarDays, Stethoscope, Building2, TrendingUp, Clock, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/layout/Layout";

const stats = [
  { label: "Marcações Hoje", value: "24", icon: CalendarDays, change: "+3" },
  { label: "Pacientes Ativos", value: "1,248", icon: Users, change: "+12" },
  { label: "Serviços", value: "12", icon: Stethoscope, change: "0" },
  { label: "Profissionais", value: "8", icon: Building2, change: "+1" },
];

const recentAppointments = [
  { patient: "João Silva", service: "Medicina Geral", time: "09:30", status: "confirmed" },
  { patient: "Maria Santos", service: "Cardiologia", time: "10:00", status: "confirmed" },
  { patient: "Pedro Costa", service: "ECG", time: "10:30", status: "pending" },
  { patient: "Ana Ferreira", service: "Fisioterapia", time: "11:00", status: "confirmed" },
  { patient: "Carlos Oliveira", service: "Análises", time: "08:00", status: "completed" },
];

export default function AdminDashboard() {
  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Painel de Administração</h1>
            <p className="text-muted-foreground text-sm">Visão geral da clínica</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1"><Settings className="w-4 h-4" /> Configurações</Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="medical-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                {stat.change !== "0" && (
                  <span className="text-xs font-medium text-success flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> {stat.change}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="appointments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="appointments">Marcações</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="practitioners">Profissionais</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <div className="medical-card overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-sm">Marcações de Hoje</h3>
              </div>
              <div className="divide-y">
                {recentAppointments.map((apt, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{apt.patient}</p>
                        <p className="text-xs text-muted-foreground">{apt.service}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {apt.time}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        apt.status === "confirmed" ? "bg-success/10 text-success" :
                        apt.status === "pending" ? "bg-warning/10 text-warning" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {apt.status === "confirmed" ? "Confirmada" : apt.status === "pending" ? "Pendente" : "Realizada"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="services">
            <div className="text-center py-16">
              <Stethoscope className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Gestão de Serviços</h3>
              <p className="text-sm text-muted-foreground">Painel completo de gestão disponível em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="practitioners">
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Gestão de Profissionais</h3>
              <p className="text-sm text-muted-foreground">Painel completo de gestão disponível em breve.</p>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Relatórios</h3>
              <p className="text-sm text-muted-foreground">Painel de relatórios disponível em breve.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
