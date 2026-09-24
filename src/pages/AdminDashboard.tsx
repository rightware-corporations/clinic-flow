import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, CalendarDays, Stethoscope, Building2, TrendingUp, Clock, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getReports, getPatients } from "@/data/medical-reports-store";
import { reportTypeLabels, reportStatusLabels } from "@/types/medical-reports";

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
  const navigate = useNavigate();
  const reports = getReports();
  const patients = getPatients();

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Painel de Administração</h1>
            <p className="text-muted-foreground text-sm">Demonstração — estatísticas e marcações fictícias</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="medical-card p-5">
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
            <TabsTrigger value="reports">Relatórios ({reports.length})</TabsTrigger>
            <TabsTrigger value="patients">Pacientes ({patients.length})</TabsTrigger>
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
                      <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {apt.time}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${apt.status === "confirmed" ? "bg-success/10 text-success" : apt.status === "pending" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                        {apt.status === "confirmed" ? "Confirmada" : apt.status === "pending" ? "Pendente" : "Realizada"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="space-y-3">
              {reports.slice(0, 5).map((report, i) => (
                <motion.div key={report.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="medical-card p-4 cursor-pointer hover:border-primary/20 transition-colors"
                  onClick={() => navigate("/relatorios")}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{report.id}</span>
                        <Badge variant={report.status === "draft" ? "outline" : "default"} className={report.status === "finalized" ? "bg-accent text-accent-foreground text-xs" : "text-xs"}>
                          {reportStatusLabels[report.status]}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{report.patientName} — {reportTypeLabels[report.type]}</p>
                      <p className="text-xs text-muted-foreground">{report.doctorName} · {new Date(report.createdAt).toLocaleDateString("pt-PT")}</p>
                    </div>
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                </motion.div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => navigate("/relatorios")}>Ver todos os relatórios</Button>
            </div>
          </TabsContent>

          <TabsContent value="patients">
            <div className="space-y-3">
              {patients.slice(0, 5).map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="medical-card p-4 cursor-pointer hover:border-primary/20 transition-colors"
                  onClick={() => navigate(`/pacientes/${p.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.id} · {p.phone} · SNS: {p.sns}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => navigate("/pacientes")}>Ver todos os pacientes</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
