import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, RefreshCw, Search, Users } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  activeTenantId, listAppointments, listPatients, type ClinicAppointment,
} from "@/lib/clinicflow-api";

function todayOnDevice(): string {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("-");
}
const statusText: Record<ClinicAppointment["status"], string> = {
  REQUESTED: "Solicitada", CONFIRMED: "Confirmada", IN_PROGRESS: "Em consulta",
  COMPLETED: "Concluída", CANCELLED: "Cancelada", NO_SHOW: "Falta",
};

export default function StaffDashboard() {
  const navigate = useNavigate();
  const tenant = activeTenantId();
  const today = todayOnDevice();
  const [search, setSearch] = useState("");
  const calendar = useQuery({
    queryKey: ["reception-calendar", tenant, today],
    queryFn: () => listAppointments(today, today),
    staleTime: 10_000,
  });
  const results = useQuery({
    queryKey: ["reception-patients", tenant, search.trim()],
    queryFn: () => listPatients(search.trim(), 0, 10),
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });

  return <DashboardLayout>
    <section className="max-w-6xl mx-auto p-5 md:p-8 space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-wider uppercase text-muted-foreground">Recepção</p>
          <h1 className="text-2xl md:text-3xl font-bold">Operação diária</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Marcações e pesquisa de pacientes ligadas ao servidor.
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate("/marcacoes")}>
          <CalendarDays className="h-4 w-4" /> Gerir marcações
        </Button>
      </header>
      <p className="border rounded-lg p-3 text-xs text-muted-foreground bg-muted/30">
        A data de hoje é calculada no dispositivo até existir um fuso horário próprio da clínica.
        A recepção não tem acesso ao conteúdo dos relatórios clínicos.
      </p>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5">
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="p-5 border-b flex justify-between items-center gap-3">
            <div>
              <h2 className="font-semibold">Agenda de hoje</h2>
              <p className="text-xs text-muted-foreground">{today}</p>
            </div>
            <Button variant="outline" size="icon" aria-label="Actualizar agenda"
              onClick={() => void calendar.refetch()}><RefreshCw className="w-4 h-4"/></Button>
          </div>
          {calendar.isPending && <p role="status" className="p-6 text-sm">A carregar marcações...</p>}
          {calendar.isError && <p role="alert" className="p-6 text-sm text-destructive">
            A agenda está indisponível. Actualize e tente novamente.
          </p>}
          {calendar.data && <>
            <div className="px-5 py-3 border-b grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-2xl font-bold tabular-nums">{calendar.data.length}</p>
                <p className="text-xs text-muted-foreground">Marcações hoje</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {calendar.data.filter(a => a.status === "REQUESTED").length}
                </p>
                <p className="text-xs text-muted-foreground">A confirmar</p>
              </div>
            </div>
            <div className="divide-y">
              {calendar.data.slice(0, 8).map(appointment => <div
                key={appointment.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{appointment.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.serviceName} · {appointment.practitionerName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm flex items-center justify-end gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {appointment.startsAt.slice(11, 16)}
                  </p>
                  <Badge variant="secondary">{statusText[appointment.status]}</Badge>
                </div>
              </div>)}
              {calendar.data.length === 0 && <p className="p-10 text-sm text-center text-muted-foreground">
                Nenhuma marcação para hoje.
              </p>}
            </div>
            <div className="border-t p-4">
              <Button variant="outline" className="w-full" onClick={() => navigate("/marcacoes")}>
                Abrir agenda completa
              </Button>
            </div>
          </>}
        </div>
        <div className="border rounded-xl bg-card p-5 space-y-4 self-start">
          <div>
            <h2 className="font-semibold">Encontrar paciente</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pesquisa autorizada, limitada aos primeiros dez resultados.
            </p>
          </div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <Input className="pl-9" aria-label="Pesquisar paciente"
              value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Nome do paciente..." />
          </div>
          {search.trim().length < 2 && <p className="text-sm text-muted-foreground">
            Introduza pelo menos dois caracteres para pesquisar.
          </p>}
          {results.isLoading && <p role="status" className="text-sm">A pesquisar...</p>}
          {results.isError && <p role="alert" className="text-sm text-destructive">
            Pesquisa indisponível.
          </p>}
          {results.data && <div className="divide-y border rounded-lg">
            {results.data.items.map(patient => <button
              type="button" key={patient.id}
              className="p-3 block w-full text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigate("/pacientes/" + encodeURIComponent(patient.id))}>
              <p className="text-sm font-medium">{patient.name}</p>
              <p className="text-xs text-muted-foreground">{patient.dateOfBirth}</p>
            </button>)}
            {results.data.items.length === 0 && <p className="text-xs text-muted-foreground p-3">
              Sem pacientes correspondentes.
            </p>}
          </div>}
          <Button variant="outline" className="w-full" onClick={() => navigate("/pacientes")}>
            <Users className="w-4 h-4 mr-2"/> Abrir registo de pacientes
          </Button>
        </div>
      </div>
    </section>
  </DashboardLayout>;
}
