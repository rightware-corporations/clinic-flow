import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, ClipboardList } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activeTenantId, listMyNursingUnits, listNursingArrivals } from "@/lib/clinicflow-api";

function deviceDate():string {
  const today=new Date();
  return [today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),
    String(today.getDate()).padStart(2,"0")].join("-");
}
export default function NursingDashboardPage(){
  const navigate=useNavigate();
  const tenant=activeTenantId();
  const today=deviceDate();
  const [unit,setUnit]=useState("");
  const units=useQuery({
    queryKey:["nursing-units",tenant],queryFn:listMyNursingUnits,
    staleTime:10_000,
  });
  const arrivals=useQuery({
    queryKey:["nursing-arrivals",tenant,today],
    queryFn:()=>listNursingArrivals(today),
    enabled:units.isSuccess&&units.data.length>0,
    staleTime:5_000,refetchInterval:30_000,
  });
  const visible=(arrivals.data??[]).filter(item=>!unit||item.unitId===unit);
  return <DashboardLayout>
    <section className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Operação clínica / Enfermagem</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Chegadas atribuídas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pacientes com chegada registada nas unidades a que tem acesso.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={()=>{
          void units.refetch();
          if(units.data?.length)void arrivals.refetch();
        }}><RefreshCw className="h-4 w-4"/>Actualizar</Button>
      </header>
      <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary"/>
        <p>A fila apresenta apenas chegadas atribuídas. O registo de observações
          é aberto individualmente e não realiza classificação de urgência nem diagnóstico.
          Data do dispositivo: {today}. O servidor restringe os resultados às unidades atribuídas.</p>
      </div>
      {units.isLoading&&<p role="status">A carregar unidades atribuídas...</p>}
      {units.isError&&<div role="alert" className="rounded-lg border p-4">
        <p>Não foi possível verificar as suas unidades. Nenhum paciente é apresentado.</p>
        <Button variant="outline" className="mt-3" onClick={()=>void units.refetch()}>
          Tentar novamente
        </Button>
      </div>}
      {units.data?.length===0&&<div className="rounded-lg border p-6">
        <h2 className="font-semibold">Sem unidades atribuídas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicite à administração uma atribuição de unidade para consultar chegadas.
        </p>
      </div>}
      {units.data&&units.data.length>0&&<>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {units.data.length} {units.data.length===1?"unidade atribuída":"unidades atribuídas"}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span>Unidade</span>
            <select aria-label="Filtrar unidade" value={unit}
              onChange={e=>setUnit(e.target.value)}
              className="rounded-md border bg-background px-3 py-2">
              <option value="">Todas as atribuídas</option>
              {units.data.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        {arrivals.isPending&&<p role="status">A consultar chegadas...</p>}
        {arrivals.isError&&<div role="alert" className="rounded-lg border p-5">
          <p>Não foi possível consultar as chegadas. O estado dos pacientes está indisponível.</p>
          <Button variant="outline" className="mt-3" onClick={()=>void arrivals.refetch()}>
            Tentar novamente
          </Button>
        </div>}
        {arrivals.isSuccess&&<div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <ClipboardList className="h-4 w-4"/> Pacientes com chegada registada
            </h2>
            <span className="text-sm text-muted-foreground">{visible.length} registos</span>
          </div>
          {visible.length===0&&<p className="p-8 text-sm text-muted-foreground">
            Não existem chegadas registadas nas unidades seleccionadas.
          </p>}
          <div className="divide-y">
            {visible.map(item=><div key={item.appointmentId} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{item.patientName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.unitName} · {item.serviceName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Marcação: {item.startsAt.slice(11,16)} ·
                  Chegada: {new Date(item.arrivedAt).toLocaleTimeString("pt-MZ",{
                    hour:"2-digit",minute:"2-digit",
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={item.queueStatus==="CALLED"?"default":"secondary"}>
                  {item.queueStatus==="CALLED"?"Chamado":"Em espera"}
                </Badge>
                {item.appointmentStatus==="IN_PROGRESS"&&<Badge variant="outline">
                  Em consulta
                </Badge>}
                <Button size="sm" variant="outline"
                  onClick={()=>navigate("/enfermagem/observacoes/"+encodeURIComponent(item.appointmentId))}>
                  Registar observações
                </Button>
              </div>
            </div>)}
          </div>
        </div>}
      </>}
    </section>
  </DashboardLayout>;
}
