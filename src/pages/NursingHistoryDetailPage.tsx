import { useEffect,useRef,useState, type FormEvent } from "react";
import { useNavigate,useParams } from "react-router-dom";
import { ArrowLeft,RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ObservationReview,{recordedAt} from "@/components/nursing/ObservationReview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,
  AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  activeTenantId,createNursingCorrection,getNursingObservation,
  getOwnNursingHistoryDetail,isClinicFlowApiError,listOwnNursingCorrections,
  type NursingCorrectionPage,type NursingHistoryItem,type NursingObservation,
} from "@/lib/clinicflow-api";

function failure(error:unknown):string {
  if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404))
    return "Já não tem acesso a esta observação ou à unidade.";
  if(isClinicFlowApiError(error,409))
    return "A chave da operação está em conflito. Verifique o estado antes de repetir.";
  return "Não foi possível guardar a correcção. Consulte o estado do registo antes de repetir.";
}

export default function NursingHistoryDetailPage(){
  const {appointmentId}=useParams<{appointmentId:string}>();
  const tenant=activeTenantId();
  const navigate=useNavigate();
  const [page,setPage]=useState(0);
  const [refreshId,setRefreshId]=useState(0);
  const [phase,setPhase]=useState<"loading"|"ready"|"blocked"|"error">("loading");
  const [summary,setSummary]=useState<NursingHistoryItem|null>(null);
  const [note,setNote]=useState<NursingObservation|null>(null);
  const [corrections,setCorrections]=useState<NursingCorrectionPage|null>(null);
  const [content,setContent]=useState("");
  const [pending,setPending]=useState(false);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [message,setMessage]=useState("");
  const keyRef=useRef<string|null>(null);

  useEffect(()=>{
    let live=true;
    setPhase("loading");setSummary(null);setNote(null);setCorrections(null);
    if(!appointmentId){setPhase("blocked");return;}
    void (async()=>{
      try{
        const item=await getOwnNursingHistoryDetail(appointmentId);
        const original=await getNursingObservation(appointmentId);
        const entries=original.status==="DRAFT"
          ?null:await listOwnNursingCorrections(appointmentId,page);
        if(!live)return;
        setSummary(item);setNote(original);setCorrections(entries);setPhase("ready");
      }catch(error){
        if(live)setPhase(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404)
          ?"blocked":"error");
      }
    })();
    return ()=>{live=false;};
  },[appointmentId,tenant,page,refreshId]);

  async function addCorrection(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();
    if(!appointmentId||!note||note.status==="DRAFT"||!content.trim()||pending)return;
    if(!keyRef.current)keyRef.current=crypto.randomUUID();
    setPending(true);setMessage("");
    try{
      await createNursingCorrection(appointmentId,content,keyRef.current);
      setContent("");keyRef.current=null;setConfirmOpen(false);
      setMessage("Correcção registada de forma permanente. Aguarda recepção pelo médico.");
      if(page!==0)setPage(0);
      else setRefreshId(n=>n+1);
    }catch(error){
      setMessage(failure(error));
      setConfirmOpen(false);
      if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404)){
        setSummary(null);setNote(null);setCorrections(null);setPhase("blocked");
      }
    }finally{setPending(false);}
  }

  return <DashboardLayout>
    <section className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Enfermagem / Histórico / Observação
          </p>
          <h1 className="mt-1 text-2xl font-bold">Registo e correcções</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={()=>navigate("/enfermagem/historico")}>
            <ArrowLeft className="mr-2 h-4 w-4"/>Histórico
          </Button>
          <Button variant="outline" disabled={pending} onClick={()=>setRefreshId(n=>n+1)}>
            <RefreshCw className="mr-2 h-4 w-4"/>Actualizar
          </Button>
        </div>
      </header>
      {phase==="loading"&&<p role="status">A confirmar acesso ao registo...</p>}
      {phase==="blocked"&&<p role="alert" className="rounded-lg border p-5">
        Esta observação não está disponível para a sua conta ou unidade actual.
      </p>}
      {phase==="error"&&<div role="alert" className="rounded-lg border p-5">
        <p>Não foi possível carregar o registo completo. Nenhum conteúdo é apresentado.</p>
        <Button variant="outline" className="mt-3" onClick={()=>setRefreshId(n=>n+1)}>
          Tentar novamente
        </Button>
      </div>}
      {phase==="ready"&&summary&&note&&<div className="space-y-6">
        <article className="space-y-5 rounded-xl border bg-card p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-semibold">{summary.patientName}</h2>
              <p className="text-sm text-muted-foreground">
                {summary.unitName} · {summary.serviceName} ·
                {" "}{summary.startsAt.slice(0,16).replace("T"," ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Registado em {recordedAt(note.createdAt)}
              </p>
            </div>
            <Badge variant={note.status==="ACKNOWLEDGED"?"default":"secondary"}>
              {note.status==="DRAFT"?"Rascunho":note.status==="SUBMITTED"
                ?"Original submetido":"Original recebido"}
            </Badge>
          </div>
          <ObservationReview note={note}/>
          {note.submittedAt&&<p className="border-t pt-3 text-xs text-muted-foreground">
            Original submetido em {recordedAt(note.submittedAt)}.
            {note.acknowledgedAt&&<> Recebido em {recordedAt(note.acknowledgedAt)}.</>}
            {" "}A recepção do original não cobre correcções posteriores.
          </p>}
          {note.status==="DRAFT"&&<div className="border-t pt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Rascunhos só podem ser editados enquanto a consulta está activa
              e a atribuição à unidade permanece válida.
            </p>
            <Button variant="outline"
              onClick={()=>navigate("/enfermagem/observacoes/"+encodeURIComponent(note.appointmentId))}>
              Abrir editor da consulta
            </Button>
          </div>}
        </article>
        {note.status!=="DRAFT"&&corrections&&<>
          <section className="rounded-xl border bg-card p-5 md:p-7 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Correcções aditivas</h2>
              <p className="text-sm text-muted-foreground">
                {corrections.total} {corrections.total===1?"entrada":"entradas"}.
                O conteúdo original não é alterado.
              </p>
            </div>
            {corrections.items.length===0&&<p className="text-sm text-muted-foreground">
              Sem correcções registadas.
            </p>}
            <div className="divide-y border-t">
              {corrections.items.map(entry=><article className="space-y-2 py-4" key={entry.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Registada em {recordedAt(entry.createdAt)}
                  </p>
                  <Badge variant={entry.acknowledgedAt?"default":"outline"}>
                    {entry.acknowledgedAt?"Recebida pelo médico":"Aguarda recepção"}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{entry.content}</p>
                {entry.acknowledgedAt&&<p className="text-xs text-muted-foreground">
                  Recepção: {recordedAt(entry.acknowledgedAt)}
                </p>}
              </article>)}
            </div>
            {corrections.total>corrections.size&&
              <div className="flex items-center justify-between border-t pt-4 text-sm">
                <span>Página {page+1} de {Math.ceil(corrections.total/corrections.size)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page===0}
                    onClick={()=>setPage(p=>p-1)}>Anterior</Button>
                  <Button size="sm" variant="outline"
                    disabled={(page+1)*corrections.size>=corrections.total}
                    onClick={()=>setPage(p=>p+1)}>Seguinte</Button>
                </div>
              </div>}
          </section>
          <section className="rounded-xl border bg-card p-5 md:p-7 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Adicionar uma correcção</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Acrescente a informação que corrige ou esclarece o registo.
                Não reescreve o original. Cada entrada fica permanente e
                exige uma confirmação de recepção independente.
              </p>
            </div>
            <form className="space-y-3" onSubmit={event=>{
              event.preventDefault();setConfirmOpen(true);
            }}>
              <Label htmlFor="n03-correction">Texto da correcção</Label>
              <Textarea id="n03-correction" rows={5} maxLength={3000}
                value={content} disabled={pending}
                onChange={event=>{
                  setContent(event.target.value);keyRef.current=null;setMessage("");
                }}/>
              <div className="flex justify-end">
                <Button type="submit" disabled={pending||!content.trim()}>
                  Registar correcção
                </Button>
              </div>
            </form>
          </section>
        </>}
        {note.status!=="DRAFT"&&!corrections&&<p role="alert">
          Correcções indisponíveis. Actualize para verificar o registo completo.
        </p>}
        {message&&<p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
      </div>}
    </section>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Registar correcção permanente?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta entrada ficará imutável, com autoria e data próprias.
            O médico responsável terá de confirmar a sua recepção separadamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={pending||!content.trim()} onClick={event=>{
            event.preventDefault();void addCorrection();
          }}>{pending?"A guardar...":"Confirmar correcção"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>;
}
