import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ObservationReview, {
  emptyMeasurements, measurementFields, recordedAt,
} from "@/components/nursing/ObservationReview";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  activeTenantId, createNursingObservation, getNursingObservation,
  isClinicFlowApiError, listMyNursingUnits, listNursingArrivals,
  submitNursingObservation, updateNursingObservation,
  type NursingArrival, type NursingMeasurements, type NursingObservation,
  type NursingObservationInput,
} from "@/lib/clinicflow-api";

type FormState = {
  presentingConcern: string;
  observationNotes: string;
  measurements: NursingMeasurements;
  measuredAtLocal: string;
};
const blank = ():FormState => ({
  presentingConcern:"", observationNotes:"", measurements:emptyMeasurements(), measuredAtLocal:"",
});
function localDateTime(value:string|null):string {
  if(!value)return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "";
  return [
    String(date.getFullYear()).padStart(4,"0"),
    String(date.getMonth()+1).padStart(2,"0"),
    String(date.getDate()).padStart(2,"0"),
  ].join("-")+"T"+[
    String(date.getHours()).padStart(2,"0"),
    String(date.getMinutes()).padStart(2,"0"),
  ].join(":");
}
function formFrom(note:NursingObservation):FormState {
  return {
    presentingConcern:note.presentingConcern,
    observationNotes:note.observationNotes,
    measurements:{...note.measurements},
    measuredAtLocal:localDateTime(note.measuredAt),
  };
}
function deviceDay():string {
  const now=new Date();
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),
    String(now.getDate()).padStart(2,"0")].join("-");
}
function payload(form:FormState):NursingObservationInput {
  const measured=Object.values(form.measurements).some(value=>value!==null);
  if(measured&&!form.measuredAtLocal)throw new Error("Indique a data e a hora das medições.");
  if(!measured&&form.measuredAtLocal)throw new Error("Retire a data ou registe pelo menos uma medição.");
  const date=form.measuredAtLocal?new Date(form.measuredAtLocal):null;
  if(date&&Number.isNaN(date.getTime()))throw new Error("Data de medição inválida.");
  return {
    presentingConcern:form.presentingConcern,
    observationNotes:form.observationNotes,
    measurements:form.measurements,
    measuredAt:date?date.toISOString():null,
  };
}
function meaningful(note:NursingObservation):boolean {
  return Boolean(note.presentingConcern.trim()||note.observationNotes.trim()
    ||Object.values(note.measurements).some(v=>v!==null));
}
function errorDescription(error:unknown):string {
  if(isClinicFlowApiError(error,409))return "O registo foi alterado entretanto. Actualize antes de repetir.";
  if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404))
    return "Esta consulta ou unidade deixou de estar disponível para a sua conta.";
  return error instanceof Error&&!isClinicFlowApiError(error)?error.message
    :"Não foi possível guardar. Verifique a ligação e confirme o estado do registo antes de repetir.";
}

export default function NursingObservationPage() {
  const {appointmentId}=useParams<{appointmentId:string}>();
  const navigate=useNavigate();
  const tenant=activeTenantId();
  const [refreshId,setRefreshId]=useState(0);
  const [phase,setPhase]=useState<"loading"|"ready"|"blocked"|"error">("loading");
  const [arrival,setArrival]=useState<NursingArrival|null>(null);
  const [note,setNote]=useState<NursingObservation|null>(null);
  const [form,setForm]=useState<FormState>(blank);
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [submitOpen,setSubmitOpen]=useState(false);

  useEffect(()=>{
    let live=true;
    setPhase("loading");
    setArrival(null);setNote(null);setForm(blank());setDirty(false);setMessage("");
    if(!appointmentId){setPhase("blocked");return;}
    void (async()=>{
      try {
        // Fresh operational check. The server independently rechecks every clinical request.
        const [units,arrivals]=await Promise.all([
          listMyNursingUnits(),listNursingArrivals(deviceDay()),
        ]);
        if(!live)return;
        const chosen=arrivals.find(item=>item.appointmentId===appointmentId
          &&units.some(unit=>unit.id===item.unitId));
        if(!chosen){setPhase("blocked");return;}
        let current:NursingObservation|null;
        try{current=await getNursingObservation(appointmentId);}
        catch(error){if(isClinicFlowApiError(error,404))current=null;else throw error;}
        if(!live)return;
        setArrival(chosen);setNote(current);
        if(current)setForm(formFrom(current));
        setPhase("ready");
      }catch{
        if(live)setPhase("error");
      }
    })();
    return()=>{live=false;};
  },[appointmentId,tenant,refreshId]);

  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!appointmentId||saving||phase!=="ready")return;
    let body:NursingObservationInput;
    try{body=payload(form);}catch(error){setMessage(errorDescription(error));return;}
    setSaving(true);setMessage("");
    try {
      const next=note
        ?await updateNursingObservation(appointmentId,note.version,body)
        :await createNursingObservation(appointmentId,body);
      setNote(next);setForm(formFrom(next));setDirty(false);
      setMessage("Rascunho guardado no servidor.");
    }catch(error){
      setMessage(errorDescription(error));
      if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404))
        {setNote(null);setPhase("blocked");}
    }finally{setSaving(false);}
  }
  async function submit(){
    if(!appointmentId||!note||note.status!=="DRAFT"||dirty||saving)return;
    setSaving(true);setMessage("");
    try{
      const next=await submitNursingObservation(appointmentId,note.version);
      setNote(next);setForm(formFrom(next));setDirty(false);
      setMessage("Observação submetida ao médico responsável. Original imutável.");
    }catch(error){
      setMessage(errorDescription(error));
      if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404))
        {setNote(null);setPhase("blocked");}
    }finally{setSaving(false);setSubmitOpen(false);}
  }
  function changeText(field:"presentingConcern"|"observationNotes",value:string){
    setForm(current=>({...current,[field]:value}));setDirty(true);setMessage("");
  }
  function changeMeasurement(field:keyof NursingMeasurements,value:string){
    setForm(current=>({...current,measurements:{
      ...current.measurements,[field]:value===""?null:Number(value),
    }}));setDirty(true);setMessage("");
  }

  return <DashboardLayout>
    <section className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Enfermagem / Observações
          </p>
          <h1 className="mt-1 text-2xl font-bold">Registo de observações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas consultas chegadas na sua unidade atribuída.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>navigate("/enfermagem")}>
            <ArrowLeft className="mr-2 h-4 w-4"/>Voltar
          </Button>
          <Button variant="outline" disabled={saving} onClick={()=>setRefreshId(n=>n+1)}>
            <RefreshCw className="mr-2 h-4 w-4"/>Actualizar
          </Button>
        </div>
      </header>
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/>
        <p>Registo de observações, não de classificação de urgência. Não são gerados
          diagnósticos, recomendações ou alertas automáticos. Use apenas dados sintéticos
          até à aprovação dos protocolos clínicos e de privacidade.</p>
      </div>
      {phase==="loading"&&<p role="status">A confirmar a unidade e a consulta...</p>}
      {phase==="blocked"&&<div role="alert" className="rounded-lg border p-5">
        Esta consulta não está disponível na sua lista actual de chegadas atribuídas.
        Volte à fila e confirme a atribuição.
      </div>}
      {phase==="error"&&<div role="alert" className="rounded-lg border p-5">
        Não foi possível verificar o seu acesso ou carregar o registo.
        <Button variant="outline" className="mt-3" onClick={()=>setRefreshId(n=>n+1)}>
          Tentar novamente
        </Button>
      </div>}
      {phase==="ready"&&arrival&&<>
        <div className="rounded-lg border bg-card p-5 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{arrival.patientName}</h2>
              <p className="text-sm text-muted-foreground">
                {arrival.unitName} · {arrival.serviceName} · {arrival.startsAt.slice(0,16).replace("T"," ")}
              </p>
            </div>
            <Badge variant={note?.status==="ACKNOWLEDGED"?"default":"secondary"}>
              {note?.status==="ACKNOWLEDGED"?"Recepção confirmada pelo médico"
                :note?.status==="SUBMITTED"?"Submetida":note?"Rascunho":"Sem registo"}
            </Badge>
          </div>
          {note?.submittedAt&&<p className="text-xs text-muted-foreground">
            Submetido em {recordedAt(note.submittedAt)}
          </p>}
        </div>
        {!note||note.status==="DRAFT"
          ?<div className="space-y-5">
            <form onSubmit={save} className="space-y-5 rounded-xl border bg-card p-5 md:p-7">
              <div>
                <h2 className="text-lg font-semibold">{note?"Editar rascunho":"Novo rascunho"}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  O registo é guardado no servidor. Apenas medições efectivamente realizadas
                  devem ser preenchidas; os campos vazios permanecem sem valor.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="n02-concern">Motivo referido</Label>
                <Textarea id="n02-concern" maxLength={1000} rows={3}
                  value={form.presentingConcern}
                  onChange={e=>changeText("presentingConcern",e.target.value)}
                  disabled={saving}/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="n02-notes">Observações da enfermagem</Label>
                <Textarea id="n02-notes" maxLength={3000} rows={4}
                  value={form.observationNotes}
                  onChange={e=>changeText("observationNotes",e.target.value)}
                  disabled={saving}/>
              </div>
              <fieldset className="space-y-4 border-t pt-5">
                <legend className="text-sm font-semibold">Medições realizadas (opcionais)</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {measurementFields.map(field=><div className="space-y-2" key={field.key}>
                    <Label htmlFor={"n02-"+field.key}>{field.label} ({field.unit})</Label>
                    <Input id={"n02-"+field.key} type="number" min={field.min} max={field.max}
                      step={field.step} value={form.measurements[field.key]??""}
                      onChange={e=>changeMeasurement(field.key,e.target.value)}
                      disabled={saving}/>
                  </div>)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="n02-measured-at">Data e hora das medições (hora do dispositivo)</Label>
                  <Input id="n02-measured-at" type="datetime-local" value={form.measuredAtLocal}
                    onChange={e=>{setForm(current=>({...current,measuredAtLocal:e.target.value}));
                      setDirty(true);setMessage("");}}
                    disabled={saving}/>
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                {dirty&&note&&<span className="text-xs text-muted-foreground">
                  Existem alterações por guardar.
                </span>}
                <Button type="submit" disabled={saving||Boolean(note&&!dirty)}>
                  {saving?"A guardar...":note?"Guardar alterações":"Criar rascunho"}
                </Button>
              </div>
            </form>
            {note&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="font-semibold">Submeter ao médico responsável</p>
                <p className="text-xs text-muted-foreground">
                  Guarde as alterações antes de submeter. O original ficará imutável.
                </p>
              </div>
              <Button disabled={saving||dirty||!meaningful(note)}
                onClick={()=>setSubmitOpen(true)}>Submeter observação</Button>
            </div>}
          </div>
          :<div className="rounded-xl border bg-card p-5 md:p-7 space-y-4">
            <h2 className="text-lg font-semibold">Registo submetido — apenas leitura</h2>
            <ObservationReview note={note}/>
            {note.acknowledgedAt&&<p className="border-t pt-3 text-sm">
              Recepção confirmada em {recordedAt(note.acknowledgedAt)}. Esta confirmação
              não é uma validação clínica ou assinatura do conteúdo.
            </p>}
          </div>}
        {message&&<p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
      </>}
    </section>
    <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submeter a observação?</AlertDialogTitle>
          <AlertDialogDescription>
            O médico atribuído poderá consultar o registo. O original ficará
            permanentemente imutável; não existe ainda um fluxo de correcções.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={event=>{
            event.preventDefault();void submit();
          }}>Confirmar submissão</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>;
}
