/**
 * CF-B6B — Clinician-owned reports. All content comes from the authenticated API.
 * Legacy localStorage reports are deliberately not imported or rendered here.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, FileText, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  activeTenantId, createClinicalAddendum, createClinicalReport,
  finalizeClinicalReport, getClinicalReport, listClinicalReports,
  listEligibleClinicalEncounters, updateClinicalReport,
  type ClinicalReportDetail, type ClinicalReportInput, type ClinicalReportSummary,
  type ClinicalReportType,
} from "@/lib/clinicflow-api";

type Mode = "list" | "create" | "view" | "edit";
const typeLabels: Record<ClinicalReportType,string> = {
  CONSULTATION:"Relatório de consulta", DIAGNOSTIC:"Relatório de diagnóstico",
  FOLLOW_UP:"Relatório de seguimento",
};
const emptyDraft:ClinicalReportInput = {
  appointmentId:"",reportType:"CONSULTATION",symptoms:"",diagnosis:"",
  observations:"",treatment:"",notes:"",
};
function localDate(value:string):string{
  return new Date(value).toLocaleString("pt-MZ",{dateStyle:"medium",timeStyle:"short"});
}
function draftFrom(report:ClinicalReportDetail):ClinicalReportInput{
  return {
    appointmentId:report.summary.appointmentId,
    reportType:report.summary.reportType,
    symptoms:report.symptoms,diagnosis:report.diagnosis,
    observations:report.observations,treatment:report.treatment,notes:report.notes,
    version:report.summary.version,
  };
}
function hasSubstantiveContent(draft:ClinicalReportInput):boolean{
  return [draft.symptoms,draft.diagnosis,draft.observations,draft.treatment]
    .some(value=>value.trim().length>0);
}

export default function MedicalReportsPage(){
  const [params]=useSearchParams();
  const preselectedPatient=params.get("patient");
  const tenant=activeTenantId();
  const queryClient=useQueryClient();
  const [mode,setMode]=useState<Mode>("list");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("ALL");
  const [typeFilter,setTypeFilter]=useState("ALL");
  const [draft,setDraft]=useState<ClinicalReportInput>({...emptyDraft});
  const [finalizeOpen,setFinalizeOpen]=useState(false);
  const [addendumText,setAddendumText]=useState("");
  const [addendumOpen,setAddendumOpen]=useState(false);
  const addendumKey=useRef<string|null>(null);

  const reports=useQuery({
    queryKey:["clinical-reports",tenant,page],
    queryFn:()=>listClinicalReports(page),
    enabled:mode==="list",
    staleTime:0,gcTime:0,
  });
  const eligible=useQuery({
    queryKey:["clinical-eligible-appointments",tenant],
    queryFn:listEligibleClinicalEncounters,
    enabled:mode==="create",
    staleTime:0,gcTime:0,
  });
  const detail=useQuery({
    queryKey:["clinical-report-detail",tenant,selectedId],
    queryFn:()=>getClinicalReport(selectedId!),
    enabled:Boolean(selectedId)&&(mode==="view"||mode==="edit"),
    staleTime:0,gcTime:0,
  });

  useEffect(()=>{
    if(mode==="edit"&&detail.data)setDraft(draftFrom(detail.data));
  },[mode,detail.data]);

  const filtered=useMemo(()=>{
    const needle=search.trim().toLowerCase();
    return (reports.data?.items??[]).filter(item=>
      (statusFilter==="ALL"||item.status===statusFilter)
      &&(typeFilter==="ALL"||item.reportType===typeFilter)
      &&(!needle||item.patientName.toLowerCase().includes(needle)
        ||item.id.toLowerCase().includes(needle)));
  },[reports.data?.items,search,statusFilter,typeFilter]);

  const save=useMutation({
    mutationFn:()=>{
      if(mode==="edit"&&selectedId){
        return updateClinicalReport(selectedId,draft);
      }
      return createClinicalReport(draft);
    },
    onSuccess:result=>{
      queryClient.setQueryData(["clinical-report-detail",tenant,result.summary.id],result);
      void queryClient.invalidateQueries({queryKey:["clinical-reports",tenant]});
      void queryClient.invalidateQueries({queryKey:["clinical-eligible-appointments",tenant]});
      setSelectedId(result.summary.id);setMode("view");
      toast.success("Rascunho guardado no servidor");
    },
    onError:(error:Error)=>{
      if(error.message.includes("409")){
        toast.error("O rascunho foi alterado noutra sessão ou já existe para esta consulta. Actualize a lista.");
      }else{
        toast.error("Não foi possível guardar. Verifique a ligação; antes de repetir, confirme se o rascunho já existe.");
      }
      void queryClient.invalidateQueries({queryKey:["clinical-reports",tenant]});
    },
  });
  const finalize=useMutation({
    mutationFn:()=>finalizeClinicalReport(selectedId!,detail.data!.summary.version),
    onSuccess:result=>{
      queryClient.setQueryData(["clinical-report-detail",tenant,result.summary.id],result);
      void queryClient.invalidateQueries({queryKey:["clinical-reports",tenant]});
      setFinalizeOpen(false);
      toast.success("Relatório finalizado. O documento original é imutável.");
    },
    onError:(error:Error)=>{
      setFinalizeOpen(false);
      toast.error(error.message.includes("409")
        ?"O relatório já mudou ou foi finalizado. Recarregue."
        :"Não foi possível finalizar o relatório.");
      void detail.refetch();
    },
  });
  const addendum=useMutation({
    mutationFn:()=>{
      if(!selectedId)throw new Error("REPORT_REQUIRED");
      if(!addendumKey.current)addendumKey.current=crypto.randomUUID();
      return createClinicalAddendum(selectedId,addendumText,addendumKey.current);
    },
    onSuccess:()=>{
      setAddendumText("");addendumKey.current=null;setAddendumOpen(false);
      toast.success("Adenda anexada de forma permanente");
      void detail.refetch();
    },
    onError:(error:Error)=>{
      setAddendumOpen(false);
      toast.error(error.message.includes("409")
        ?"A chave já foi usada para outra correcção. Recarregue o relatório."
        :"Não foi possível guardar a adenda. Pode repetir sem alterar o texto.");
    },
  });

  function back(){
    setMode("list");setSelectedId(null);setDraft({...emptyDraft});
    setAddendumText("");addendumKey.current=null;
  }
  function openCreate(){
    setSelectedId(null);setDraft({...emptyDraft});
    setMode("create");
  }
  function openView(id:string){
    setSelectedId(id);setMode("view");
  }
  function openEdit(report:ClinicalReportDetail){
    if(report.summary.status!=="DRAFT")return;
    setDraft(draftFrom(report));setMode("edit");
  }
  function saveDraft(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!draft.appointmentId){toast.error("Seleccione uma consulta atribuída.");return;}
    if(!save.isPending)save.mutate();
  }
  function changeField(field:keyof Pick<ClinicalReportInput,
    "symptoms"|"diagnosis"|"observations"|"treatment"|"notes">,value:string){
    setDraft(current=>({...current,[field]:value}));
  }

  const report=detail.data;
  return <DashboardLayout>
    <div className="max-w-6xl mx-auto px-5 py-8 md:px-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground">
            Documentação clínica
          </p>
          <h1 className="text-2xl md:text-3xl font-bold">Relatórios clínicos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rascunhos, finalização e adendas das suas consultas atribuídas.
          </p>
        </div>
        {mode==="list"?<Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4"/> Novo relatório
        </Button>:<Button variant="outline" onClick={back} className="gap-2">
          <ArrowLeft className="w-4 h-4"/> Voltar à lista
        </Button>}
      </header>

      <div className="border rounded-lg bg-muted/30 px-4 py-3 flex items-start gap-3 print:hidden">
        <ShieldCheck className="w-5 h-5 shrink-0 text-primary"/>
        <p className="text-xs text-muted-foreground">
          Acesso restrito ao profissional responsável. Os relatórios finalizados não podem
          ser reescritos; qualquer correcção fica numa adenda permanente.
          Ambiente de desenvolvimento: utilize exclusivamente dados sintéticos.
        </p>
      </div>

      {mode==="list"&&<section className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[210px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
            <Input aria-label="Pesquisar relatórios nesta página"
              placeholder="Paciente ou identificador (página actual)"
              className="pl-9" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <select aria-label="Filtrar por estado" value={statusFilter}
            onChange={e=>setStatusFilter(e.target.value)}
            className="border rounded-md h-10 px-3 bg-background text-sm">
            <option value="ALL">Todos os estados</option>
            <option value="DRAFT">Rascunhos</option>
            <option value="FINALIZED">Finalizados</option>
          </select>
          <select aria-label="Filtrar por tipo" value={typeFilter}
            onChange={e=>setTypeFilter(e.target.value)}
            className="border rounded-md h-10 px-3 bg-background text-sm">
            <option value="ALL">Todos os tipos</option>
            {Object.entries(typeLabels).map(([key,label])=>
              <option key={key} value={key}>{label}</option>)}
          </select>
          <Button size="icon" variant="outline" title="Actualizar"
            onClick={()=>void reports.refetch()}><RefreshCw className="w-4 h-4"/></Button>
        </div>
        {reports.isLoading&&<p role="status" className="py-10 text-sm">A carregar relatórios...</p>}
        {reports.isError&&<div role="alert" className="border rounded-lg p-5">
          <p>Não foi possível carregar os relatórios.</p>
          <Button className="mt-3" variant="outline" onClick={()=>void reports.refetch()}>
            Tentar novamente
          </Button>
        </div>}
        {reports.data&&<div className="border rounded-xl bg-card overflow-hidden">
          {filtered.map(item=><div key={item.id}
            className="p-4 border-b last:border-b-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="bg-primary/10 rounded-lg p-2 shrink-0">
                <FileText className="w-5 h-5 text-primary"/>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.patientName}</p>
                  <Badge variant={item.status==="FINALIZED"?"default":"outline"}>
                    {item.status==="FINALIZED"?"Finalizado":"Rascunho"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{typeLabels[item.reportType]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Actualizado {localDate(item.updatedAt)}
                </p>
                <p className="font-mono text-xs text-muted-foreground truncate mt-1" title={item.id}>
                  {item.id}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={()=>openView(item.id)}>
              Abrir
            </Button>
          </div>)}
          {filtered.length===0&&<div className="p-12 text-center text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40"/>
            <p>Nenhum relatório encontrado nesta página.</p>
          </div>}
        </div>}
        {reports.data&&<div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Página {page+1} · {reports.data.total} relatório(s)
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page===0}
              onClick={()=>setPage(n=>n-1)}>Anterior</Button>
            <Button size="sm" variant="outline"
              disabled={(page+1)*reports.data.size>=reports.data.total}
              onClick={()=>setPage(n=>n+1)}>Seguinte</Button>
          </div>
        </div>}
      </section>}

      {mode==="create"&&<section className="space-y-4">
        <h2 className="text-xl font-semibold">Novo rascunho clínico</h2>
        {eligible.isLoading&&<p role="status">A consultar consultas atribuídas...</p>}
        {eligible.isError&&<div role="alert" className="border rounded-lg p-4">
          <p>Não foi possível consultar as consultas disponíveis.</p>
          <Button variant="outline" onClick={()=>void eligible.refetch()}>Tentar novamente</Button>
        </div>}
        {eligible.data&&eligible.data.length===0&&<p className="border rounded-lg p-5 text-sm">
          Não existem consultas iniciadas ou concluídas, sem relatório, atribuídas à sua conta.
          Inicie a consulta na agenda para poder criar um relatório.
        </p>}
        {eligible.data&&eligible.data.length>0&&<form onSubmit={saveDraft}
          className="border bg-card rounded-xl p-5 md:p-7 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="clinical-encounter">Consulta atribuída</Label>
              <select id="clinical-encounter" required value={draft.appointmentId}
                onChange={e=>setDraft(current=>({...current,appointmentId:e.target.value}))}
                className="w-full border rounded-md bg-background p-2.5 text-sm">
                <option value="">Seleccionar consulta</option>
                {eligible.data.filter(e=>!preselectedPatient||e.patientId===preselectedPatient)
                  .map(item=><option key={item.id} value={item.id}>
                    {item.patientName} · {item.serviceName} · {item.startsAt.slice(0,16).replace("T"," ")}
                  </option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clinical-type">Tipo de relatório</Label>
              <select id="clinical-type" required value={draft.reportType}
                onChange={e=>setDraft(current=>({
                  ...current,reportType:e.target.value as ClinicalReportType,
                }))}
                className="w-full border rounded-md bg-background p-2.5 text-sm">
                {Object.entries(typeLabels).map(([key,label])=>
                  <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
          <ClinicalFields value={draft} onChange={changeField}/>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={back}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending||!draft.appointmentId}>
              {save.isPending?"A guardar...":"Guardar rascunho"}
            </Button>
          </div>
        </form>}
      </section>}

      {(mode==="view"||mode==="edit")&&selectedId&&<>
        {detail.isLoading&&<p role="status">A carregar relatório...</p>}
        {detail.isError&&<div role="alert" className="border rounded-lg p-5">
          <p>Relatório indisponível ou acesso não autorizado.</p>
          <Button variant="outline" onClick={()=>void detail.refetch()}>Tentar novamente</Button>
        </div>}
        {report&&mode==="edit"&&<section className="border bg-card rounded-xl p-5 md:p-7">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Editar rascunho</p>
            <h2 className="text-xl font-semibold">{report.summary.patientName}</h2>
            <p className="text-xs font-mono text-muted-foreground">{report.summary.id}</p>
          </div>
          <form onSubmit={saveDraft} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-clinical-type">Tipo de relatório</Label>
              <select id="edit-clinical-type" required value={draft.reportType}
                className="w-full border rounded-md bg-background p-2.5 text-sm"
                onChange={e=>setDraft(current=>({
                  ...current,reportType:e.target.value as ClinicalReportType,
                }))}>
                {Object.entries(typeLabels).map(([key,label])=>
                  <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <ClinicalFields value={draft} onChange={changeField}/>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={()=>setMode("view")}>Cancelar</Button>
              <Button disabled={save.isPending} type="submit">
                {save.isPending?"A guardar...":"Guardar alterações"}
              </Button>
            </div>
          </form>
        </section>}
        {report&&mode==="view"&&<section className="space-y-5">
          <div className="border bg-card rounded-xl p-5 md:p-8 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {typeLabels[report.summary.reportType]}
                </p>
                <h2 className="text-2xl font-bold">{report.summary.patientName}</h2>
                <p className="text-xs font-mono text-muted-foreground">
                  Relatório {report.summary.id}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado {localDate(report.summary.createdAt)}
                </p>
              </div>
              <Badge variant={report.summary.status==="FINALIZED"?"default":"outline"}>
                {report.summary.status==="FINALIZED"?"Finalizado":"Rascunho"}
              </Badge>
            </div>
            {report.summary.status==="FINALIZED"&&<p
              className="text-xs text-muted-foreground border-l-2 border-primary pl-3">
              Finalizado {localDate(report.summary.finalizedAt!)} · Original imutável.
            </p>}
            <div className="grid sm:grid-cols-2 gap-4">
              {([
                ["Sintomas e queixas",report.symptoms],
                ["Diagnóstico",report.diagnosis],
                ["Observações clínicas",report.observations],
                ["Tratamento e recomendações",report.treatment],
                ["Notas adicionais",report.notes],
              ] as const).map(([title,value])=><div key={title}
                className="border-t pt-4 space-y-1 sm:odd:col-span-2">
                <h3 className="font-medium text-sm">{title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {value||"Não registado"}
                </p>
              </div>)}
            </div>
            {report.summary.status==="DRAFT"&&<div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button variant="outline" onClick={()=>openEdit(report)}>Editar rascunho</Button>
              <Button disabled={!hasSubstantiveContent(draftFrom(report))}
                onClick={()=>setFinalizeOpen(true)}>
                Finalizar documento
              </Button>
            </div>}
          </div>

          {report.summary.status==="FINALIZED"&&<div className="border bg-card rounded-xl p-5 md:p-7 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Adendas</h3>
              <p className="text-xs text-muted-foreground">
                Correcções permanentes. O texto original não é substituído.
              </p>
            </div>
            {report.addenda.length===0&&<p className="text-sm text-muted-foreground">
              Não existem adendas.
            </p>}
            {report.addenda.map(item=><article key={item.id}
              className="border-l-2 border-primary pl-4 py-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                {localDate(item.createdAt)} · {item.id}
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
            </article>)}
            <form className="space-y-3" onSubmit={e=>{e.preventDefault();setAddendumOpen(true);}}>
              <Label htmlFor="new-addendum">Adicionar uma correcção</Label>
              <Textarea id="new-addendum" maxLength={8000} rows={4}
                placeholder="Descreva a correcção ou informação complementar..."
                value={addendumText}
                onChange={e=>{setAddendumText(e.target.value);addendumKey.current=null;}}
                disabled={addendum.isPending}/>
              <div className="flex justify-end">
                <Button type="submit" disabled={!addendumText.trim()||addendum.isPending}>
                  Registar adenda
                </Button>
              </div>
            </form>
          </div>}
        </section>}
      </>}

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento original fica permanentemente imutável.
              Para futuras correcções, utilize uma adenda registada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalize.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={finalize.isPending} onClick={event=>{
              event.preventDefault();
              if(report&&!finalize.isPending)finalize.mutate();
            }}> {finalize.isPending?"A finalizar...":"Finalizar"} </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={addendumOpen} onOpenChange={setAddendumOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registar adenda permanente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta correcção não pode ser alterada ou eliminada após guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={addendum.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={addendum.isPending} onClick={event=>{
              event.preventDefault();
              if(!addendum.isPending&&addendumText.trim())addendum.mutate();
            }}>{addendum.isPending?"A guardar...":"Confirmar adenda"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </DashboardLayout>;
}

type ClinicalField = "symptoms"|"diagnosis"|"observations"|"treatment"|"notes";
const fields:{key:ClinicalField;label:string;placeholder:string}[]=[
  {key:"symptoms",label:"Sintomas e queixas",placeholder:"Sintomas relatados..."},
  {key:"diagnosis",label:"Diagnóstico",placeholder:"Diagnóstico clínico..."},
  {key:"observations",label:"Observações clínicas",placeholder:"Resultados e observações..."},
  {key:"treatment",label:"Tratamento e recomendações",placeholder:"Medidas terapêuticas e seguimento..."},
  {key:"notes",label:"Notas adicionais",placeholder:"Notas de acompanhamento..."},
];
function ClinicalFields({value,onChange}:{value:ClinicalReportInput;
  onChange:(key:ClinicalField,value:string)=>void}){
  return <div className="grid gap-5">
    {fields.map(field=><div className="space-y-1.5" key={field.key}>
      <Label htmlFor={"report-"+field.key}>{field.label}</Label>
      <Textarea id={"report-"+field.key} value={value[field.key]}
        placeholder={field.placeholder} rows={4} maxLength={8000}
        onChange={e=>onChange(field.key,e.target.value)}/>
    </div>)}
  </div>;
}
