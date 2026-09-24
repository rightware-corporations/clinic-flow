import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  activeTenantId, me, listAppointments, listBookableProfessionals,
  listClinicServices, listClinicUnits, listPatients, getSlotPreview,
  createAppointment, rescheduleAppointment, commandAppointment,
  type ClinicAppointment, type AppointmentCommand,
} from "@/lib/clinicflow-api";

type Draft = {
  patientId:string; practitionerUserId:string; serviceId:string;
  unitId:string; date:string; time:string;
};
type Action = {appointment:ClinicAppointment; command:AppointmentCommand; label:string};
const statusText:Record<ClinicAppointment["status"],string>={
  REQUESTED:"Solicitada", CONFIRMED:"Confirmada", IN_PROGRESS:"Em consulta",
  COMPLETED:"Concluída", CANCELLED:"Cancelada", NO_SHOW:"Falta",
};
function ymd(date:Date){
  return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")
    +"-"+String(date.getDate()).padStart(2,"0");
}
function addDays(iso:string,days:number){
  const d=new Date(iso+"T12:00:00");
  d.setDate(d.getDate()+days);
  return ymd(d);
}
function blank():Draft{
  return {patientId:"",practitionerUserId:"",serviceId:"",unitId:"",
    date:ymd(new Date()),time:""};
}

export default function InternalAppointmentsPage(){
  const tenant=activeTenantId();
  const queryClient=useQueryClient();
  const [from,setFrom]=useState(ymd(new Date()));
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState<Draft>(blank);
  const [search,setSearch]=useState("");
  const [rescheduling,setRescheduling]=useState<ClinicAppointment|null>(null);
  const [pending,setPending]=useState<Action|null>(null);
  const retryKey=useRef<string|null>(null);

  const session=useQuery({queryKey:["booking-session",tenant],queryFn:me,staleTime:30_000});
  const role=session.data?.memberships.find(m=>m.tenantId===tenant)?.role;
  const canBook=role==="CLINIC_ADMIN"||role==="RECEPTION";
  const canTreat=role==="CLINIC_ADMIN"||role==="PRACTITIONER";
  const calendar=useQuery({
    queryKey:["appointments-calendar",tenant,from],
    queryFn:()=>listAppointments(from,addDays(from,6)),
    enabled:session.isSuccess&&Boolean(role&&from),
    staleTime:10_000,
  });
  const catalog=useQuery({
    queryKey:["appointments-catalog",tenant],
    queryFn:async()=>{
      const [professionals,services,units]=await Promise.all([
        listBookableProfessionals(),listClinicServices(),listClinicUnits(),
      ]);
      return {professionals,services,units};
    },
    enabled:open&&canBook,
  });
  const patients=useQuery({
    queryKey:["booking-patients",tenant,search],
    queryFn:()=>listPatients(search,0,50),
    enabled:open&&canBook&&search.trim().length>=2,
  });
  const preview=useQuery({
    queryKey:["booking-slots",tenant,draft.practitionerUserId,draft.serviceId,draft.date],
    queryFn:()=>getSlotPreview(draft.practitionerUserId,draft.serviceId,draft.date),
    enabled:open&&canBook&&Boolean(draft.practitionerUserId&&draft.serviceId&&draft.date),
    staleTime:0,
  });

  const practitioner=catalog.data?.professionals.find(p=>p.userId===draft.practitionerUserId);
  const matching=catalog.data?.professionals.filter(p=>p.serviceIds.includes(draft.serviceId))??[];
  const eligibleUnits=catalog.data?.units.filter(u=>u.active&&practitioner?.unitIds.includes(u.id))??[];
  const slots=preview.data?.slots.filter(s=>s.unitId===draft.unitId)??[];

  const refresh=()=>queryClient.invalidateQueries({queryKey:["appointments-calendar",tenant]});
  const save=useMutation({
    mutationFn:async()=>{
      if(!draft.patientId||!draft.practitionerUserId||!draft.serviceId||!draft.unitId||!draft.time)
        throw new Error("INCOMPLETE");
      const startsAt=draft.date+"T"+draft.time;
      if(rescheduling){
        return rescheduleAppointment(rescheduling.id,{
          version:rescheduling.version,unitId:draft.unitId,startsAt,
        });
      }
      if(!retryKey.current)retryKey.current=crypto.randomUUID();
      return createAppointment({
        patientId:draft.patientId,practitionerUserId:draft.practitionerUserId,
        unitId:draft.unitId,serviceId:draft.serviceId,startsAt,
      },retryKey.current);
    },
    onSuccess:()=>{
      toast.success(rescheduling?"Marcação reagendada":"Marcação registada");
      retryKey.current=null;
      setOpen(false);setRescheduling(null);setDraft(blank());
      void refresh();
    },
    onError:(error:Error)=>{
      toast.error(error.message.includes("409")
        ?"Conflito de horário ou versão: actualize a agenda e tente novamente."
        :"Não foi possível guardar a marcação.");
      void preview.refetch();
    },
  });
  const transition=useMutation({
    mutationFn:(action:Action)=>commandAppointment(
      action.appointment.id,action.command,action.appointment.version),
    onSuccess:()=>{toast.success("Estado actualizado");setPending(null);void refresh();},
    onError:()=>{
      toast.error("A marcação não foi actualizada. Actualize a agenda.");
      setPending(null);void refresh();
    },
  });

  function change(patch:Partial<Draft>){
    retryKey.current=null;
    setDraft(value=>({...value,...patch}));
  }
  function create(){
    setRescheduling(null);setDraft(blank());setSearch("");
    retryKey.current=null;setOpen(true);
  }
  function reschedule(item:ClinicAppointment){
    setRescheduling(item);
    setDraft({patientId:item.patientId,practitionerUserId:item.practitionerUserId,
      unitId:item.unitId,serviceId:item.serviceId,
      date:item.startsAt.slice(0,10),time:""});
    retryKey.current=null;setOpen(true);
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!save.isPending)save.mutate();
  }
  function actions(item:ClinicAppointment):{command:AppointmentCommand;label:string}[]{
    if(item.status==="REQUESTED"&&canBook)
      return [{command:"confirm",label:"Confirmar"},{command:"cancel",label:"Cancelar"}];
    if(item.status==="CONFIRMED"){
      const next:{command:AppointmentCommand;label:string}[]=[];
      if(canBook)next.push({command:"cancel",label:"Cancelar"},{command:"no-show",label:"Registar falta"});
      if(canTreat&&(role==="CLINIC_ADMIN"||session.data?.id===item.practitionerUserId))
        next.unshift({command:"start",label:"Iniciar"});
      return next;
    }
    if(item.status==="IN_PROGRESS"&&canTreat&&
      (role==="CLINIC_ADMIN"||session.data?.id===item.practitionerUserId))
      return [{command:"complete",label:"Concluir"}];
    return [];
  }

  return <DashboardLayout>
    <section className="max-w-6xl mx-auto p-5 md:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Operação clínica</p>
          <h1 className="text-2xl md:text-3xl font-bold">Agenda de marcações</h1>
          <p className="text-sm text-muted-foreground">
            {role==="PRACTITIONER"?"Consultas atribuídas ao seu perfil":"Consultas desta clínica"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={()=>void calendar.refetch()}>
            <RefreshCw className="w-4 h-4"/> Actualizar
          </Button>
          {canBook&&<Button className="gap-2" onClick={create}>
            <Plus className="w-4 h-4"/> Nova marcação
          </Button>}
        </div>
      </header>
      <p className="border rounded-lg p-3 text-xs text-muted-foreground">
        Agenda autenticada. Os horários ainda seguem o tempo local da clínica;
        fuso horário, notificações e revisão de privacidade são gates pendentes.
        Utilize apenas dados sintéticos nesta fase.
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor="week-date">Semana a partir de</Label>
          <Input id="week-date" type="date" required value={from}
            onChange={e=>setFrom(e.target.value)}/>
        </div>
        {from&&<span className="text-sm text-muted-foreground pb-2">
          {from} até {addDays(from,6)}
        </span>}
      </div>
      {session.isError&&<p role="alert">Não foi possível verificar a sessão.</p>}
      {calendar.isLoading&&<p role="status" className="py-8">A carregar agenda...</p>}
      {calendar.isError&&<div className="border rounded-lg p-4">
        <p>Não foi possível carregar as marcações.</p>
        <Button variant="outline" className="mt-2" onClick={()=>void calendar.refetch()}>
          Tentar novamente
        </Button>
      </div>}
      {calendar.data&&<div className="border rounded-xl bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data / hora</TableHead><TableHead>Paciente</TableHead>
            <TableHead>Profissional / serviço</TableHead><TableHead>Estado</TableHead>
            <TableHead className="text-right">Acções</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {calendar.data.map(item=><TableRow key={item.id}>
              <TableCell className="whitespace-nowrap">
                <p className="flex gap-1.5 font-medium items-center">
                  <Clock3 className="w-4 h-4"/> {item.startsAt.replace("T"," · ").slice(0,18)}
                </p>
                <p className="text-xs text-muted-foreground">{item.unitName}</p>
              </TableCell>
              <TableCell className="font-medium">{item.patientName}</TableCell>
              <TableCell>
                <p>{item.practitionerName}</p>
                <p className="text-xs text-muted-foreground">{item.serviceName}</p>
              </TableCell>
              <TableCell><Badge variant={item.status==="CANCELLED"?"destructive":"secondary"}>
                {statusText[item.status]}
              </Badge></TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  {canBook&&["REQUESTED","CONFIRMED"].includes(item.status)&&
                    <Button size="sm" variant="outline" onClick={()=>reschedule(item)}>Reagendar</Button>}
                  {actions(item).map(action=><Button key={action.command} size="sm"
                    variant="outline" onClick={()=>setPending({appointment:item,...action})}>
                    {action.label}
                  </Button>)}
                </div>
              </TableCell>
            </TableRow>)}
            {calendar.data.length===0&&<TableRow><TableCell colSpan={5}
              className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-9 h-9 opacity-40 mx-auto mb-3"/>
              Nenhuma marcação neste período.
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>}
    </section>

    <Dialog open={open} onOpenChange={value=>{if(!save.isPending)setOpen(value);}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rescheduling?"Reagendar consulta":"Registar marcação"}</DialogTitle>
          <DialogDescription>
            O servidor confirma a disponibilidade e impede sobreposições ao guardar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {rescheduling?<p className="border rounded-lg p-3 text-sm">
            {rescheduling.patientName} · {rescheduling.serviceName} · {rescheduling.practitionerName}
          </p>:<div className="space-y-1.5">
            <Label htmlFor="patient-search">Pesquisar paciente</Label>
            <Input id="patient-search" value={search}
              onChange={e=>{setSearch(e.target.value);change({patientId:""});}}
              placeholder="Pelo menos dois caracteres"/>
            {patients.isLoading&&<p className="text-xs">A pesquisar...</p>}
            {patients.isError&&<p role="alert" className="text-xs text-destructive">
              Pesquisa indisponível.
            </p>}
            {patients.data&&<select aria-label="Paciente" className="w-full rounded-md border bg-background p-2.5 text-sm"
              value={draft.patientId} onChange={e=>change({patientId:e.target.value})} required>
              <option value="">Seleccionar paciente</option>
              {patients.data.items.map(p=><option key={p.id} value={p.id}>
                {p.name} · {p.dateOfBirth}
              </option>)}
            </select>}
          </div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="service">Serviço</Label>
              <select id="service" className="w-full rounded-md border bg-background p-2.5 text-sm"
                value={draft.serviceId} disabled={Boolean(rescheduling)}
                onChange={e=>change({serviceId:e.target.value,practitionerUserId:"",unitId:"",time:""})}
                required>
                <option value="">Seleccionar serviço</option>
                {catalog.data?.services.filter(s=>s.active).map(s=>
                  <option value={s.id} key={s.id}>{s.name} · {s.durationMinutes} min</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professional">Profissional</Label>
              <select id="professional" className="w-full rounded-md border bg-background p-2.5 text-sm"
                value={draft.practitionerUserId} disabled={!draft.serviceId||Boolean(rescheduling)}
                onChange={e=>change({practitionerUserId:e.target.value,unitId:"",time:""})}
                required>
                <option value="">Seleccionar profissional</option>
                {matching.map(p=><option value={p.userId} key={p.userId}>{p.displayName}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unidade</Label>
              <select id="unit" className="w-full rounded-md border bg-background p-2.5 text-sm"
                value={draft.unitId} disabled={!draft.practitionerUserId}
                onChange={e=>change({unitId:e.target.value,time:""})} required>
                <option value="">Seleccionar unidade</option>
                {eligibleUnits.map(unit=><option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-date">Data</Label>
              <Input id="appointment-date" required type="date" value={draft.date}
                min={ymd(new Date())} max={addDays(ymd(new Date()),180)}
                onChange={e=>change({date:e.target.value,time:""})}/>
            </div>
          </div>
          <fieldset className="border rounded-lg p-4 space-y-3">
            <legend className="text-sm font-medium px-2">Horários disponíveis</legend>
            {!draft.unitId&&<p className="text-sm text-muted-foreground">
              Escolha serviço, profissional e unidade.
            </p>}
            {preview.isLoading&&<p role="status">A consultar disponibilidade...</p>}
            {preview.isError&&<p role="alert" className="text-sm text-destructive">
              Não foi possível consultar os horários.
            </p>}
            {draft.unitId&&preview.data&&slots.length===0&&
              <p className="text-sm text-muted-foreground">Sem horários nesta unidade.</p>}
            {draft.unitId&&slots.length>0&&<div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {slots.map(slot=><button type="button" key={slot.startsAt}
                aria-pressed={draft.time===slot.startsAt}
                onClick={()=>change({time:slot.startsAt})}
                className={"p-2 rounded-md border text-sm focus-visible:ring-2 focus-visible:ring-ring "+
                  (draft.time===slot.startsAt?"border-primary bg-primary/10":"hover:border-primary/50")}>
                {slot.startsAt.slice(0,5)}
              </button>)}
            </div>}
          </fieldset>
          {catalog.isError&&<p role="alert" className="text-sm text-destructive">
            Catálogo indisponível. Tente novamente.
          </p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={save.isPending}
              onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending||!draft.patientId||!draft.practitionerUserId
              ||!draft.serviceId||!draft.unitId||!draft.time}>
              {save.isPending?"A guardar...":rescheduling?"Confirmar reagendamento":"Registar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={pending!==null}
      onOpenChange={value=>{if(!value&&!transition.isPending)setPending(null);}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.label} marcação?</AlertDialogTitle>
          <AlertDialogDescription>
            A operação será registada na auditoria e no histórico da marcação.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={transition.isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={transition.isPending}
            onClick={e=>{e.preventDefault();if(pending)transition.mutate(pending);}}>
            {transition.isPending?"A actualizar...":"Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>;
}
