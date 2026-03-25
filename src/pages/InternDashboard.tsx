/**
 * InternDashboard — Intern/Estagiário dashboard
 * 
 * Focus: read-only access, learning, observation
 * Access: I### IDs
 * Permissions: view patients, view reports (read-only), no editing
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  FileText,
  Users,
  Calendar,
  Eye,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { getReports, getPatients } from "@/data/medical-reports-store";
import { reportTypeLabels, reportStatusLabels } from "@/types/medical-reports";

export default function InternDashboard() {
  const navigate = useNavigate();
  const reports = useMemo(() => getReports(), []);
  const patients = useMemo(() => getPatients(), []);
  const finalizedReports = reports.filter((r) => r.status === "finalized");

  const todaySchedule = [
    { time: "09:00", activity: "Observação — Consulta Medicina Geral", doctor: "Dra. Ana Mendes" },
    { time: "10:30", activity: "Estudo de caso — Cardiologia", doctor: "Dr. Ricardo Silva" },
    { time: "14:00", activity: "Observação — Dermatologia", doctor: "Dra. Sofia Marques" },
    { time: "16:00", activity: "Revisão de relatórios", doctor: "Dra. Ana Mendes" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel do Interno</h1>
          <p className="text-sm text-muted-foreground">Modo de observação e aprendizagem</p>
        </div>

        {/* Read-only notice */}
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-lg p-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <p className="text-sm text-warning">Acesso em modo leitura. Contacte um supervisor para ações que requerem autorização.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Relatórios Disponíveis", value: finalizedReports.length, icon: FileText },
            { label: "Pacientes", value: patients.length, icon: Users },
            { label: "Sessões Hoje", value: todaySchedule.length, icon: Calendar },
            { label: "Horas de Observação", value: "12h", icon: Clock },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <stat.icon className="w-4 h-4" />
                    {stat.label}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{typeof stat.value === "number" ? stat.value : stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Programa de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaySchedule.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <span className="text-sm font-bold text-primary min-w-[45px]">{item.time}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.activity}</p>
                    <p className="text-xs text-muted-foreground">{item.doctor}</p>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {/* Recent reports (read-only) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Relatórios para Estudo
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/relatorios")}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {finalizedReports.slice(0, 4).map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate("/relatorios")}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-muted-foreground">{report.id}</span>
                      <Badge variant="secondary" className="text-[10px]">{reportTypeLabels[report.type]}</Badge>
                    </div>
                    <p className="text-sm font-medium">{report.patientName}</p>
                    <p className="text-xs text-muted-foreground">{report.doctorName}</p>
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
