/**
 * PatientProfilePage — Detailed patient view
 * 
 * Core page showing patient info, appointment history, and medical reports timeline.
 * Quick actions: create report, view reports.
 * 
 * Route: /pacientes/:id
 */

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ReportView from "@/components/reports/ReportView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Calendar,
  Eye,
  Clock,
} from "lucide-react";
import { getPatient } from "@/data/medical-reports-store";
import { getReportsByPatient } from "@/data/medical-reports-store";
import { MedicalReport, reportTypeLabels, reportStatusLabels } from "@/types/medical-reports";

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [viewingReport, setViewingReport] = useState<MedicalReport | null>(null);

  const patient = id ? getPatient(id) : undefined;
  const reports = id ? getReportsByPatient(id) : [];

  const sortedReports = useMemo(() =>
    [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reports]
  );

  // Mock appointments for this patient
  const appointments = useMemo(() => [
    { id: "apt-1", service: "Consulta de Medicina Geral", doctor: "Dra. Ana Mendes", date: "2026-03-20", time: "09:30", status: "completed" as const },
    { id: "apt-2", service: "Cardiologia", doctor: "Dr. Ricardo Silva", date: "2026-03-21", time: "14:00", status: "completed" as const },
    { id: "apt-3", service: "Consulta de Seguimento", doctor: "Dra. Ana Mendes", date: "2026-03-28", time: "10:00", status: "upcoming" as const },
  ], []);

  if (!patient) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <User className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Paciente não encontrado</h2>
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  if (viewingReport) {
    return (
      <Layout>
        <div className="container py-8 md:py-12">
          <ReportView
            report={viewingReport}
            onBack={() => setViewingReport(null)}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 md:py-12 space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        {/* Patient header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
                <p className="text-sm text-muted-foreground">ID: {patient.id} · SNS: {patient.sns}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(patient.dateOfBirth).toLocaleDateString("pt-PT")}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {patient.phone}</span>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {patient.email}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {patient.address}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/relatorios?patient=${patient.id}`)} className="gap-2">
                <FileText className="w-4 h-4" />
                Ver Relatórios
              </Button>
              <Button onClick={() => navigate(`/relatorios?patient=${patient.id}`)} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Relatório
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Consultas", value: appointments.length, icon: Calendar },
            { label: "Relatórios", value: reports.length, icon: FileText },
            { label: "Rascunhos", value: reports.filter(r => r.status === "draft").length, icon: Clock },
            { label: "Finalizados", value: reports.filter(r => r.status === "finalized").length, icon: Eye },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-lg p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <stat.icon className="w-4 h-4" />
                {stat.label}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs: Reports timeline + Appointments */}
        <Tabs defaultValue="reports" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reports">Relatórios ({reports.length})</TabsTrigger>
            <TabsTrigger value="appointments">Consultas ({appointments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            {sortedReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Sem relatórios para este paciente</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate(`/relatorios?patient=${patient.id}`)}>
                  <Plus className="w-4 h-4" /> Criar primeiro relatório
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedReports.map((report, i) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setViewingReport(report)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{report.id}</span>
                          <Badge variant={report.status === "draft" ? "outline" : "default"} className={report.status === "finalized" ? "bg-accent text-accent-foreground text-xs" : "text-xs"}>
                            {reportStatusLabels[report.status]}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm">{reportTypeLabels[report.type]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {report.doctorName} · {new Date(report.createdAt).toLocaleDateString("pt-PT")}
                        </p>
                        {report.diagnosis && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{report.diagnosis}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments">
            <div className="space-y-3">
              {appointments.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{apt.service}</p>
                      <p className="text-xs text-muted-foreground">{apt.doctor} · {new Date(apt.date).toLocaleDateString("pt-PT")} às {apt.time}</p>
                    </div>
                    <Badge variant={apt.status === "completed" ? "secondary" : "default"} className="text-xs">
                      {apt.status === "completed" ? "Realizada" : "Agendada"}
                    </Badge>
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
