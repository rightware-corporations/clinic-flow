import { useEffect,useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordedAt } from "@/components/nursing/ObservationReview";
import {
  acknowledgeNursingCorrection,listPractitionerNursingCorrections,
  isClinicFlowApiError,
  type NursingCorrectionPage,
} from "@/lib/clinicflow-api";

export default function PractitionerCorrections({
  appointmentId,tenant,
}:{appointmentId:string;tenant:string}){
  const [page,setPage]=useState(0);
  const [reload,setReload]=useState(0);
  const [status,setStatus]=useState<"loading"|"ready"|"blocked"|"error">("loading");
  const [data,setData]=useState<NursingCorrectionPage|null>(null);
  const [pending,setPending]=useState<string|null>(null);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let live=true;
    setStatus("loading");setData(null);setMessage("");
    void listPractitionerNursingCorrections(appointmentId,page)
      .then(result=>{if(live){setData(result);setStatus("ready");}})
      .catch(error=>{
        if(!live)return;
        setStatus(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404)
          ?"blocked":"error");
      });
    return()=>{live=false;};
  },[appointmentId,tenant,page,reload]);

  async function acknowledge(correctionId:string){
    if(pending)return;
    setPending(correctionId);setMessage("");
    try{
      const updated=await acknowledgeNursingCorrection(appointmentId,correctionId);
      setData(current=>current?{...current,items:current.items.map(item=>
        item.id===updated.id?updated:item)}:current);
      setMessage("Recepção desta correcção confirmada; não implica validação clínica.");
      // Keep the confirmed server response while refreshing other correction states.
      void listPractitionerNursingCorrections(appointmentId,page)
        .then(result=>setData(result))
        .catch(()=>setMessage(
          "Recepção confirmada; não foi possível actualizar a lista. Actualize para verificar as restantes."));
    }catch(error){
      setMessage(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404)
        ?"Perdeu o acesso a esta correcção."
        :isClinicFlowApiError(error,409)
          ?"Esta correcção mudou entretanto. Actualize."
          :"Não foi possível confirmar a recepção. Verifique o estado antes de repetir.");
      if(isClinicFlowApiError(error,403)||isClinicFlowApiError(error,404)){
        setData(null);setStatus("blocked");
      }
    }finally{setPending(null);}
  }

  return <section className="space-y-4 border-t pt-5" aria-label="Correcções da enfermagem">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Correcções posteriores</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada correcção exige confirmação de recepção própria, mesmo se
          o original já tiver sido recebido. Confirmação não é validação clínica.
        </p>
      </div>
      <Button size="sm" variant="outline" disabled={Boolean(pending)}
        onClick={()=>setReload(n=>n+1)}>
        <RefreshCw className="mr-2 h-4 w-4"/>Actualizar
      </Button>
    </div>
    {status==="loading"&&<p role="status" className="text-sm">
      A consultar correcções...
    </p>}
    {status==="blocked"&&<p role="alert" className="text-sm">
      O acesso às correcções desta consulta não está autorizado.
    </p>}
    {status==="error"&&<p role="alert" className="text-sm">
      O estado das correcções está indisponível. Não presuma que não existem.
    </p>}
    {status==="ready"&&data&&<>
      <p className="text-sm text-muted-foreground">
        {data.total} {data.total===1?"correcção":"correcções"} registadas.
        {" "}Nesta página, {data.items.filter(item=>!item.acknowledgedAt).length} por confirmar.
      </p>
      {data.items.length===0&&<p className="text-sm text-muted-foreground">
        Sem correcções posteriores registadas.
      </p>}
      <div className="divide-y">
        {data.items.map(entry=><article key={entry.id} className="space-y-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Registada em {recordedAt(entry.createdAt)}
            </p>
            <Badge variant={entry.acknowledgedAt?"default":"outline"}>
              {entry.acknowledgedAt?"Recebida":"Por confirmar"}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">{entry.content}</p>
          {entry.acknowledgedAt
            ?<p className="text-xs text-muted-foreground">
              Recepção confirmada em {recordedAt(entry.acknowledgedAt)}.
            </p>
            :<div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={Boolean(pending)}
                onClick={()=>void acknowledge(entry.id)}>
                {pending===entry.id?"A confirmar...":"Confirmar recepção desta correcção"}
              </Button>
            </div>}
        </article>)}
      </div>
      {data.total>data.size&&<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
        <span>Página {page+1} de {Math.ceil(data.total/data.size)}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page===0||Boolean(pending)}
            onClick={()=>setPage(n=>n-1)}>Anterior</Button>
          <Button variant="outline" size="sm"
            disabled={(page+1)*data.size>=data.total||Boolean(pending)}
            onClick={()=>setPage(n=>n+1)}>Seguinte</Button>
        </div>
      </div>}
    </>}
    {message&&<p role="status" className="rounded-md border p-3 text-sm">{message}</p>}
  </section>;
}
