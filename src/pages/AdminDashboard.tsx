import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, RefreshCw, Stethoscope, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  activeTenantId, listAppointments, listClinicServices, listPatients, listProfessionals,
  type ClinicAppointment,
} from "@/lib/clinicflow-api";

function todayOnDevice(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("-");
}
const statuses: Record<ClinicAppointment["status"], string> = {
  REQUESTED: "Solicitada", CONFIRMED: "Confirmada", IN_PROGRESS: "Em consulta",
  COMPLETED: "Concluída", CANCELLED: "Cancelada", NO_SHOW: "Falta",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const tenant = activeTenantId();
  const today = todayOnDevice();
  const dashboard = useQuery({
    queryKey: ["clinicflow-admin-overview", tenant, today],
    queryFn: async () => {
      const [appointments, patients, services, professionals] = await Promise.all([
        listAppointments(today, today),
        listPatients("", 0, 1),
        listClinicServices(),
        listProfessionals(),
      ]);
      return {
        appointments,
        totalPatients: patients.total,
        activeServices: services.filter(item => item.active).length,
        activeProfessionals: professionals.filter(item => item.active).length,
      };
    },
    staleTime: 15_000,
  });

  const stats = dashboard.data ? [
    { label: "Marcações hoje", value: dashboard.data.appointments.length, icon: CalendarDays },
    { label: "Pacientes activos", value: dashboard.data.totalPatients, icon: Users },
    { label: "Serviços activos", value: dashboard.data.activeServices, icon: Stethoscope },
    { label: "Profissionais activos", value: dashboard.data.activeProfessionals, icon: Activity },
  ] : [];

  return <DashboardLayout>
    <section className="max-w-6xl mx-auto space-y-7 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Gestão operacional</p>
          <h1 className="text-2xl md:text-3xl font-bold">Painel de administração</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Indicadores da clínica obtidos dos registos autorizados no servidor.
          </p>
        </div>
        <Button variant="outline" onClick={() => void dashboard.refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </header>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        A definição de «hoje» usa a data do dispositivo. O fuso horário de cada clínica
        ainda precisa de ser configurado. O administrador não pode consultar conteúdo
        de relatórios clínicos através deste painel.
      </div>

      {dashboard.isPending && <p role="status" className="py-8">A carregar indicadores...</p>}
      {dashboard.isError && <div role="alert" className="rounded-lg border p-5 space-y-3">
        <p>Os indicadores não estão disponíveis. Nenhum número fictício é apresentado.</p>
        <Button variant="outline" onClick={() => void dashboard.refetch()}>Tentar novamente</Button>
      </div>}

      {dashboard.data && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map(item => <div key={item.label}
            className="rounded-xl border bg-card p-4 md:p-5 space-y-4">
            <span className="inline-flex rounded-lg p-2 bg-primary/10 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl md:text-3xl font-bold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          </div>)}
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-5">
          <section className="rounded-xl border bg-card overflow-hidden">
            <div className="p-5 flex flex-wrap items-center justify-between gap-3 border-b">
              <div>
                <h2 className="font-semibold">Marcações de hoje</h2>
                <p className="text-xs text-muted-foreground">{today} · calendário autenticado</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/marcacoes")}>
                Abrir agenda
              </Button>
            </div>
            <div className="divide-y">
              {dashboard.data.appointments.slice(0, 8).map(appointment => <div
                key={appointment.id} className="p-4 flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{appointment.patientName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {appointment.serviceName} · {appointment.practitionerName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{appointment.unitName}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <p className="text-sm font-medium tabular-nums">
                    {appointment.startsAt.slice(11, 16)}
                  </p>
                  <Badge variant={appointment.status === "CANCELLED" ? "destructive" : "secondary"}>
                    {statuses[appointment.status]}
                  </Badge>
                </div>
              </div>)}
              {dashboard.data.appointments.length === 0 &&
                <p className="p-10 text-sm text-muted-foreground text-center">
                  Não existem marcações para esta data.
                </p>}
            </div>
            {dashboard.data.appointments.length > 8 &&
              <p className="text-xs text-muted-foreground px-5 py-3 border-t">
                A mostrar 8 de {dashboard.data.appointments.length} marcações.
              </p>}
          </section>

          <section className="rounded-xl border bg-card p-5 space-y-4 self-start">
            <h2 className="font-semibold">Gestão da clínica</h2>
            <p className="text-xs text-muted-foreground">
              Utilize os módulos próprios para alterar registos. Este painel apenas apresenta
              um resumo operacional.
            </p>
            <div className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => navigate("/pacientes")}>
                <Users className="w-4 h-4 mr-2"/> Gerir pacientes
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/profissionais")}>
                <Stethoscope className="w-4 h-4 mr-2"/> Gerir profissionais
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/equipa")}>
                <Users className="w-4 h-4 mr-2"/> Equipa e convites
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate("/marcacoes")}>
                <CalendarDays className="w-4 h-4 mr-2"/> Agenda de marcações
              </Button>
            </div>
          </section>
        </div>
      </>}
    </section>
  </DashboardLayout>;
}
