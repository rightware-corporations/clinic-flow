import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileClock, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activeTenantId, listOwnNursingHistory } from "@/lib/clinicflow-api";

const statuses={DRAFT:"Rascunho",SUBMITTED:"Submetido",ACKNOWLEDGED:"Original recebido"};

export default function NursingHistoryPage(){
  const navigate=useNavigate();
  const tenant=activeTenantId();
  const [page,setPage]=useState(0);
  const history=useQuery({
    queryKey:["nursing-history",tenant,page],
    queryFn:()=>listOwnNursingHistory(page),
    staleTime:0,
    gcTime:0, // Evict scoped patient metadata as soon as this page unmounts.
  });
  return <DashboardLayout>
    <section className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Enfermagem / Registos da sua autoria
          </p>
          <h1 className="mt-1 text-2xl font-bold">Histórico de observações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas observações da sua autoria em unidades actualmente atribuídas.
            As consultas concluídas permanecem disponíveis para consulta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={()=>navigate("/enfermagem")}>
            <ArrowLeft className="mr-2 h-4 w-4"/>Chegadas
          </Button>
          <Button variant="outline" onClick={()=>void history.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4"/>Actualizar
          </Button>
        </div>
      </header>
      {history.isPending&&<p role="status">A carregar o seu histórico...</p>}
      {history.isError&&<div role="alert" className="rounded-lg border p-5">
        <p>Não foi possível verificar o histórico autorizado. Nenhum registo é apresentado.</p>
        <Button variant="outline" className="mt-3" onClick={()=>void history.refetch()}>
          Tentar novamente
        </Button>
      </div>}
      {history.isSuccess&&<section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileClock className="h-4 w-4"/>Registos encontrados
          </h2>
          <p className="text-sm text-muted-foreground">{history.data.total} registos</p>
        </div>
        {history.data.items.length===0&&<p className="p-8 text-sm text-muted-foreground">
          Não existem observações acessíveis nesta página.
        </p>}
        <div className="divide-y">
          {history.data.items.map(item=><article key={item.observationId}
            className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{item.patientName}</p>
              <p className="text-sm text-muted-foreground">{item.unitName} · {item.serviceName}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Consulta: {item.startsAt.slice(0,16).replace("T"," ")}
                {" · "}{item.correctionCount} {item.correctionCount===1?"correcção":"correcções"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.status==="ACKNOWLEDGED"?"default":"secondary"}>
                {statuses[item.status]}
              </Badge>
              <Button size="sm" variant="outline"
                onClick={()=>navigate("/enfermagem/historico/"+encodeURIComponent(item.appointmentId))}>
                Abrir registo
              </Button>
            </div>
          </article>)}
        </div>
        {history.data.total>history.data.size&&
          <div className="flex items-center justify-between gap-3 border-t p-4 text-sm">
            <span>Página {page+1} de {Math.ceil(history.data.total/history.data.size)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===0}
                onClick={()=>setPage(p=>p-1)}>Anterior</Button>
              <Button size="sm" variant="outline"
                disabled={(page+1)*history.data.size>=history.data.total}
                onClick={()=>setPage(p=>p+1)}>Seguinte</Button>
            </div>
          </div>}
      </section>}
      <p className="text-xs text-muted-foreground">
        O histórico contém apenas registos para os quais conserva autorização activa.
        Não é um processo de triagem automática.
      </p>
    </section>
  </DashboardLayout>;
}
