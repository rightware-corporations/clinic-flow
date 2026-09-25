import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Clock3, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  activeTenantId, listAppointments, listClinicalReports, listMyPatientArrivals,
  type ClinicAppointment, type ClinicalReportSummary,
} from "@/lib/clinicflow-api";

function todayOnDevice():string {
  const now=new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),
    String(now.getDate()).padStart(2,"0")].join("-");
}
const statuses:Record<ClinicAppointment["status"],string>={
  REQUESTED:"Solicitada",CONFIRMED:"Confirmada",IN_PROGRESS:"Em consulta",
  COMPLETED:"Concluída",CANCELLED:"Cancelada",NO_SHOW:"Falta",
};
const reportTypes:Record<ClinicalReportSummary["reportType"],string>={
  CONSULTATION:"Consulta",DIAGNOSTIC:"Diagnóstico",FOLLOW_UP:"Seguimento",
};

export default function PractitionerDashboard(){
  const navigate=useNavigate();
  const tenant=activeTenantId();
  const today=todayOnDevice();
  const dashboard=useQuery({
    queryKey:["practitioner-overview",tenant,today],
    queryFn:async()=>{
      // Both endpoints restrict data to the authenticated practitioner on the server.
      const [appointments,reports]=await Promise.all([
        listAppointments(today,today),
        listClinicalReports(0),
      ]);
      return {appointments,reports};
    },
    staleTime:10_000,
  });
  // Independent query: reception API failure must not hide the clinician's own agenda.
  const arrivals=useQuery({
    queryKey:["practitioner-arrivals",tenant,today],
    queryFn:()=>listMyPatientArrivals(today),
    staleTime:5_000,
    refetchInterval:30_000,
  });
  const arrivalsByAppointment=new Map(
    (arrivals.data??[]).map(item=>[item.appointmentId,item]),
  );
  const current=dashboard.data;
  const stats=current?[
    {label:"Consultas hoje",value:current.appointments.length,icon:CalendarDays},
    {label:"Confirmadas",value:current.appointments.filter(a=>a.status==="CONFIRMED").length,icon:Clock3},
    {label:"Em consulta",value:current.appointments.filter(a=>a.status==="IN_PROGRESS").length,icon:ClipboardList},
    {label:"Meus relatórios",value:current.reports.total,icon:FileText},
  ]:[];

  return <DashboardLayout>
    <section className="p-5 md:p-8 max-w-6xl mx-auto space-y-7">
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Área profissional</p>
          <h1 className="text-2xl md:text-3xl font-bold">O meu dia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas as consultas e os relatórios associados à sua conta profissional.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2"
            onClick={()=>{void dashboard.refetch();void arrivals.refetch();}}>
            <RefreshCw className="w-4 h-4"/> Actualizar
          </Button>
          <Button className="gap-2" onClick={()=>navigate("/marcacoes")}>
            <CalendarDays className="w-4 h-4"/> Abrir agenda
          </Button>
        </div>
      </header>
      <div className="border rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 text-primary"/>
        <p>Os dados vêm do servidor. Inicie e conclua consultas na agenda real; crie
          os documentos na área de relatórios. A definição de hoje segue a data do
          dispositivo até ser configurado o fuso horário da clínica.</p>
      </div>
      {dashboard.isPending&&<p role="status" className="py-8">A carregar os seus registos...</p>}
      {dashboard.isError&&<div role="alert" className="border rounded-lg p-5 space-y-3">
        <p>Não foi possível consultar os registos. Nenhuma informação fictícia é apresentada.</p>
        <Button variant="outline" onClick={()=>void dashboard.refetch()}>Tentar novamente</Button>
      </div>}

      {current&&<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(stat=><div key={stat.label} className="border rounded-xl p-4 bg-card space-y-3">
            <span className="p-2 bg-primary/10 text-primary inline-flex rounded-lg">
              <stat.icon className="w-5 h-5"/>
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          </div>)}
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <section className="border rounded-xl bg-card overflow-hidden">
            <div className="border-b p-5 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="font-semibold">Consultas de hoje</h2>
                <p className="text-xs text-muted-foreground">{today} · agenda própria</p>
                {arrivals.isSuccess&&<p className="text-xs text-muted-foreground mt-1">
                  {arrivals.data.length} chegadas registadas nas suas consultas
                </p>}
                {arrivals.isPending&&<p className="text-xs text-muted-foreground mt-1">
                  A verificar chegadas...
                </p>}
                {arrivals.isError&&<p role="alert" className="text-xs text-destructive mt-1">
                  Estado de chegada indisponível.
                </p>}
              </div>
              <Button variant="outline" size="sm" onClick={()=>navigate("/marcacoes")}>
                Gerir consultas
              </Button>
            </div>
            <div className="divide-y">
              {current.appointments.slice(0,8).map(item=><div
                key={item.id} className="p-4 flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{item.patientName}</p>
                  <p className="text-xs text-muted-foreground">{item.serviceName} · {item.unitName}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium tabular-nums">
                    {item.startsAt.slice(11,16)}
                  </p>
                  <Badge variant={item.status==="CANCELLED"?"destructive":"secondary"}>
                    {statuses[item.status]}
                  </Badge>
                  {["CONFIRMED","IN_PROGRESS","COMPLETED"].includes(item.status)&&
                    <Button size="sm" variant="outline" className="mt-2"
                      onClick={()=>navigate("/profissional/observacoes-enfermagem/"+encodeURIComponent(item.id))}>
                      Ver observações da enfermagem
                    </Button>}
                  {item.status==="CONFIRMED"&&arrivals.isSuccess&&<p className="mt-2">
                    {arrivalsByAppointment.has(item.id)
                      ? <Badge variant={arrivalsByAppointment.get(item.id)?.queueStatus==="CALLED"
                          ?"default":"outline"}>
                          {arrivalsByAppointment.get(item.id)?.queueStatus==="CALLED"
                            ?"Chamado pela recepção":"Chegada registada"}
                        </Badge>
                      : <span className="text-xs text-muted-foreground">
                          Sem chegada registada
                        </span>}
                  </p>}
                </div>
              </div>)}
              {current.appointments.length===0&&<p className="text-center text-sm text-muted-foreground p-10">
                Não existem consultas atribuídas para hoje.
              </p>}
            </div>
          </section>
          <section className="border rounded-xl bg-card p-5 space-y-4 self-start">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h2 className="font-semibold">Relatórios recentes</h2>
                <p className="text-xs text-muted-foreground">Documentos da sua autoria</p>
              </div>
              <FileText className="w-5 h-5 text-muted-foreground"/>
            </div>
            <div className="divide-y">
              {current.reports.items.slice(0,5).map(report=><div
                key={report.id} className="py-3 space-y-1">
                <p className="text-sm font-medium">{report.patientName}</p>
                <p className="text-xs text-muted-foreground">{reportTypes[report.reportType]}</p>
                <Badge variant={report.status==="FINALIZED"?"default":"outline"}>
                  {report.status==="FINALIZED"?"Finalizado":"Rascunho"}
                </Badge>
              </div>)}
              {current.reports.items.length===0&&<p className="text-xs text-muted-foreground py-5">
                Sem relatórios associados a esta conta.
              </p>}
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={()=>navigate("/relatorios")}>
              <FileText className="w-4 h-4"/> Abrir relatórios
            </Button>
          </section>
        </div>
      </>}
    </section>
  </DashboardLayout>;
}
