import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ObservationReview, { recordedAt } from "@/components/nursing/ObservationReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acknowledgeNursingObservation, activeTenantId,
  getPractitionerNursingObservation, isClinicFlowApiError,
  type NursingObservation,
} from "@/lib/clinicflow-api";

export default function PractitionerNursingObservationPage() {
  const {appointmentId}=useParams<{appointmentId:string}>();
  const tenant=activeTenantId();
  const navigate=useNavigate();
  const [refreshId,setRefreshId]=useState(0);
  const [state,setState]=useState<"loading"|"ready"|"missing"|"forbidden"|"error">("loading");
  const [note,setNote]=useState<NursingObservation|null>(null);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let live=true;
    setState("loading");setNote(null);setMessage("");
    if(!appointmentId){setState("missing");return;}
    void getPractitionerNursingObservation(appointmentId)
      .then(result=>{if(live){setNote(result);setState("ready");}})
      .catch(error=>{
        if(!live)return;
        setState(isClinicFlowApiError(error,404)?"missing"
          :isClinicFlowApiError(error,403)?"forbidden":"error");
      });
    return ()=>{live=false;};
  },[tenant,appointmentId,refreshId]);

  async function acknowledge() {
    if(!appointmentId||!note||note.status!=="SUBMITTED"||pending)return;
    setPending(true);setMessage("");
    try{
      const updated=await acknowledgeNursingObservation(appointmentId);
      setNote(updated);
      setMessage("Recepção registada. A confirmação não valida clinicamente o conteúdo.");
    }catch(error){
      setMessage(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404)
        ?"Esta consulta deixou de estar disponível para a sua conta."
        :isClinicFlowApiError(error,409)
          ?"O registo mudou entretanto. Actualize para verificar o estado."
          :"Não foi possível confirmar a recepção. Verifique a ligação e o estado do registo.");
      if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404))
        {setNote(null);setState("forbidden");}
    }finally{setPending(false);}
  }

  return <DashboardLayout>
    <section className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Área profissional / Passagem de informação
          </p>
          <h1 className="mt-1 text-2xl font-bold">Observações recebidas da enfermagem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso restrito à consulta atribuída à sua conta profissional.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>navigate("/profissional")}>
            <ArrowLeft className="mr-2 h-4 w-4"/>Voltar
          </Button>
          <Button variant="outline" disabled={pending} onClick={()=>setRefreshId(n=>n+1)}>
            <RefreshCw className="mr-2 h-4 w-4"/>Actualizar
          </Button>
        </div>
      </header>
      <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/>
        <p>Observação registada pela enfermagem. A confirmação de recepção
          não é validação clínica, assinatura, diagnóstico nem classificação de urgência.</p>
      </div>
      {state==="loading"&&<p role="status">A carregar observações da consulta...</p>}
      {state==="missing"&&<div role="status" className="rounded-lg border p-5">
        Não existe observação submetida acessível nesta consulta. Uma observação
        em rascunho não é visível ao médico.
      </div>}
      {state==="forbidden"&&<div role="alert" className="rounded-lg border p-5">
        Não tem acesso às observações desta consulta.
      </div>}
      {state==="error"&&<div role="alert" className="rounded-lg border p-5 space-y-3">
        <p>Não foi possível consultar as observações. O estado está indisponível.</p>
        <Button variant="outline" onClick={()=>setRefreshId(n=>n+1)}>Tentar novamente</Button>
      </div>}
      {state==="ready"&&note&&<article className="rounded-xl border bg-card p-5 md:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="text-lg font-semibold">Consulta {note.appointmentId.slice(0,8)}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Observação submetida em {recordedAt(note.submittedAt)}
            </p>
          </div>
          <Badge variant={note.status==="ACKNOWLEDGED"?"default":"secondary"}>
            {note.status==="ACKNOWLEDGED"?"Recepção confirmada":"Por confirmar"}
          </Badge>
        </div>
        <ObservationReview note={note}/>
        {note.status==="SUBMITTED"&&<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="max-w-lg text-xs text-muted-foreground">
            Confirme apenas que recebeu e consultou o registo. A acção não altera
            o conteúdo nem constitui um parecer clínico.
          </p>
          <Button disabled={pending} onClick={()=>void acknowledge()}>
            {pending?"A confirmar...":"Confirmar recepção"}
          </Button>
        </div>}
        {note.status==="ACKNOWLEDGED"&&<p className="border-t pt-4 text-sm">
          Recepção confirmada em {recordedAt(note.acknowledgedAt)}.
        </p>}
      </article>}
      {message&&<p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    </section>
  </DashboardLayout>;
}
