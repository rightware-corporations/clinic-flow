import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Clock3, Pencil, Plus, RefreshCw, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  activeTenantId, createClinicUnit, createClinicService, listClinicUnits,
  listClinicServices, setClinicUnitActive, setClinicServiceActive,
  updateClinicUnit, updateClinicService, type ClinicUnitInput,
  type ClinicServiceInput, type ClinicUnitRecord, type ClinicServiceRecord,
} from "@/lib/clinicflow-api";

type UnitDraft = ClinicUnitInput & { id?: string };
type ServiceDraft = {
  id?: string; name: string; slug: string; duration: string;
  price: string; currencyCode: string;
};
type Pending =
  | {kind:"unit"; target:ClinicUnitRecord; activate:boolean}
  | {kind:"service"; target:ClinicServiceRecord; activate:boolean};

const emptyUnit:UnitDraft={name:"",address:null};
const emptyService:ServiceDraft={
  name:"",slug:"",duration:"30",price:"",currencyCode:"",
};
function toSlug(text:string){
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function serviceInput(draft:ServiceDraft):ClinicServiceInput{
  const duration=Number(draft.duration);
  if(!Number.isInteger(duration)||duration<5||duration>480){
    throw new Error("DURATION_INVALID");
  }
  const price=draft.price.trim();
  if(price!==""&&!/^\d{1,10}(\.\d{1,2})?$/.test(price)){
    throw new Error("PRICE_INVALID");
  }
  const currency=draft.currencyCode.trim().toUpperCase();
  if((price==="")!== (currency==="")){
    throw new Error("PRICE_CURRENCY_REQUIRED_TOGETHER");
  }
  if(currency!==""&&!/^[A-Z]{3}$/.test(currency)){
    throw new Error("CURRENCY_INVALID");
  }
  return {
    name:draft.name.trim(),
    slug:draft.slug.trim(),
    durationMinutes:duration,
    price:price===""?null:Number(price),
    currencyCode:currency===""?null:currency,
  };
}
function money(value:ClinicServiceRecord){
  if(value.price===null||!value.currencyCode)return "Preço por definir";
  return new Intl.NumberFormat("pt-MZ",{
    style:"currency",currency:value.currencyCode,
    minimumFractionDigits:2,maximumFractionDigits:2,
  }).format(value.price);
}

export default function AdminCatalogPage(){
  const tenant=activeTenantId();
  const queryClient=useQueryClient();
  const [unitDialog,setUnitDialog]=useState(false);
  const [serviceDialog,setServiceDialog]=useState(false);
  const [unitDraft,setUnitDraft]=useState<UnitDraft>({...emptyUnit});
  const [serviceDraft,setServiceDraft]=useState<ServiceDraft>({...emptyService});
  const [pending,setPending]=useState<Pending|null>(null);

  const catalog=useQuery({
    queryKey:["clinic-admin-catalog",tenant],
    queryFn:async()=>{
      const [units,services]=await Promise.all([listClinicUnits(),listClinicServices()]);
      return {units,services};
    },
    staleTime:15_000,
  });
  const refresh=()=>queryClient.invalidateQueries({queryKey:["clinic-admin-catalog",tenant]});
  const unitSave=useMutation({
    mutationFn:(input:UnitDraft)=>input.id
      ? updateClinicUnit(input.id,{name:input.name.trim(),address:input.address?.trim()||null})
      : createClinicUnit({name:input.name.trim(),address:input.address?.trim()||null}),
    onSuccess:()=>{
      toast.success("Unidade guardada");
      setUnitDialog(false);
      void refresh();
    },
    onError:(error:Error)=>toast.error(error.message.includes("409")
      ?"Já existe uma unidade activa com este nome."
      :"Não foi possível guardar a unidade."),
  });
  const serviceSave=useMutation({
    mutationFn:(draft:ServiceDraft)=>{
      const input=serviceInput(draft);
      return draft.id?updateClinicService(draft.id,input):createClinicService(input);
    },
    onSuccess:()=>{
      toast.success("Serviço guardado");
      setServiceDialog(false);
      void refresh();
    },
    onError:(error:Error)=>{
      if(error.message==="DURATION_INVALID"){
        toast.error("Duração inválida (5–480 minutos).");
      }else if(error.message==="PRICE_INVALID"){
        toast.error("Preço inválido: utilize até duas casas decimais, com ponto.");
      }else if(error.message==="PRICE_CURRENCY_REQUIRED_TOGETHER"||error.message==="CURRENCY_INVALID"){
        toast.error("Indique preço e moeda ISO de três letras em conjunto.");
      }else{
        toast.error(error.message.includes("409")
          ?"Já existe um serviço com este código nesta clínica."
          :"Não foi possível guardar o serviço.");
      }
    },
  });
  const status=useMutation({
    mutationFn:(action:Pending)=>action.kind==="unit"
      ? setClinicUnitActive(action.target.id,action.activate)
      : setClinicServiceActive(action.target.id,action.activate),
    onSuccess:()=>{
      setPending(null);toast.success("Estado actualizado");void refresh();
    },
    onError:(error:Error)=>{
      setPending(null);
      toast.error(error.message.includes("409")
        ?"Não é possível concluir: há associações ou marcações activas, ou um conflito de nome/código."
        :"Não foi possível alterar o estado.");
      void refresh();
    },
  });

  function submitUnit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!unitSave.isPending)unitSave.mutate(unitDraft);
  }
  function submitService(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!serviceSave.isPending)serviceSave.mutate(serviceDraft);
  }
  function addUnit(){setUnitDraft({...emptyUnit});setUnitDialog(true);}
  function editUnit(unit:ClinicUnitRecord){
    setUnitDraft({id:unit.id,name:unit.name,address:unit.address});setUnitDialog(true);
  }
  function addService(){setServiceDraft({...emptyService});setServiceDialog(true);}
  function editService(service:ClinicServiceRecord){
    setServiceDraft({
      id:service.id,name:service.name,slug:service.slug,
      duration:String(service.durationMinutes),
      price:service.price===null?"":String(service.price),
      currencyCode:service.currencyCode??"",
    });
    setServiceDialog(true);
  }

  return <DashboardLayout>
    <section className="max-w-6xl mx-auto space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground">Configuração operacional</p>
          <h1 className="text-2xl md:text-3xl font-bold">Unidades e serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o catálogo utilizado pelas equipas, escalas e marcações.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={()=>void catalog.refetch()}>
          <RefreshCw className="w-4 h-4"/> Actualizar
        </Button>
      </header>

      <div className="border rounded-lg bg-muted/30 p-4 text-xs text-muted-foreground">
        A desactivação não apaga dados históricos. Unidades e serviços associados
        a profissionais ou a consultas activas não podem ser desactivados. Todas
        as alterações exigem autorização administrativa verificada no servidor.
      </div>

      {catalog.isLoading&&<p role="status" className="py-8">A carregar o catálogo...</p>}
      {catalog.isError&&<div role="alert" className="border rounded-lg p-5">
        <p>O catálogo não está disponível. Nenhum registo fictício é apresentado.</p>
        <Button variant="outline" className="mt-3"
          onClick={()=>void catalog.refetch()}>Tentar novamente</Button>
      </div>}
      {catalog.data&&<Tabs defaultValue="units" className="space-y-5">
        <TabsList>
          <TabsTrigger value="units">Unidades ({catalog.data.units.length})</TabsTrigger>
          <TabsTrigger value="services">Serviços ({catalog.data.services.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {catalog.data.units.filter(unit=>unit.active).length} unidade(s) activa(s)
            </p>
            <Button className="gap-2" onClick={addUnit}>
              <Plus className="w-4 h-4"/> Nova unidade
            </Button>
          </div>
          <div className="border rounded-xl bg-card divide-y">
            {catalog.data.units.map(unit=><div key={unit.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-3 items-start">
                <span className="inline-flex p-2.5 bg-primary/10 text-primary rounded-lg">
                  <Building2 className="w-5 h-5"/>
                </span>
                <div>
                  <p className="font-semibold">{unit.name}</p>
                  <p className="text-xs text-muted-foreground">{unit.address||"Morada por definir"}</p>
                  <Badge variant={unit.active?"default":"secondary"} className="mt-2">
                    {unit.active?"Activa":"Inactiva"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {unit.active&&<Button size="sm" variant="outline" className="gap-1"
                  onClick={()=>editUnit(unit)}>
                  <Pencil className="w-3.5 h-3.5"/> Editar
                </Button>}
                <Button size="sm" variant={unit.active?"outline":"default"}
                  onClick={()=>setPending({kind:"unit",target:unit,activate:!unit.active})}>
                  {unit.active?"Desactivar":"Reactivar"}
                </Button>
              </div>
            </div>)}
            {catalog.data.units.length===0&&<div className="p-10 text-center text-muted-foreground">
              <Building2 className="w-9 h-9 opacity-40 mx-auto mb-3"/>
              Ainda não existem unidades clínicas nesta organização.
            </div>}
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {catalog.data.services.filter(service=>service.active).length} serviço(s) activo(s)
            </p>
            <Button className="gap-2" onClick={addService}>
              <Plus className="w-4 h-4"/> Novo serviço
            </Button>
          </div>
          <div className="border rounded-xl bg-card divide-y">
            {catalog.data.services.map(service=><div key={service.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-3 items-start">
                <span className="inline-flex p-2.5 bg-primary/10 text-primary rounded-lg">
                  <Stethoscope className="w-5 h-5"/>
                </span>
                <div>
                  <p className="font-semibold">{service.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{service.slug}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex gap-1 items-center">
                    <Clock3 className="w-3.5 h-3.5"/>
                    {service.durationMinutes} min · {money(service)}
                  </p>
                  <Badge variant={service.active?"default":"secondary"} className="mt-2">
                    {service.active?"Activo":"Inactivo"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {service.active&&<Button size="sm" variant="outline" className="gap-1"
                  onClick={()=>editService(service)}>
                  <Pencil className="w-3.5 h-3.5"/> Editar
                </Button>}
                <Button size="sm" variant={service.active?"outline":"default"}
                  onClick={()=>setPending({kind:"service",target:service,activate:!service.active})}>
                  {service.active?"Desactivar":"Reactivar"}
                </Button>
              </div>
            </div>)}
            {catalog.data.services.length===0&&<div className="p-10 text-center text-muted-foreground">
              <Stethoscope className="w-9 h-9 opacity-40 mx-auto mb-3"/>
              Ainda não existem serviços clínicos registados.
            </div>}
          </div>
        </TabsContent>
      </Tabs>}
    </section>

    <Dialog open={unitDialog} onOpenChange={value=>{if(!unitSave.isPending)setUnitDialog(value);}}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{unitDraft.id?"Editar unidade":"Nova unidade clínica"}</DialogTitle>
          <DialogDescription>O nome deve ser único entre as unidades activas desta clínica.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitUnit}>
          <div className="space-y-1.5">
            <Label htmlFor="unit-name">Nome da unidade</Label>
            <Input id="unit-name" required maxLength={160} value={unitDraft.name}
              onChange={e=>setUnitDraft({...unitDraft,name:e.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit-address">Morada (opcional)</Label>
            <Input id="unit-address" maxLength={500} value={unitDraft.address??""}
              onChange={e=>setUnitDraft({...unitDraft,address:e.target.value||null})}/>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={()=>setUnitDialog(false)}>Cancelar</Button>
            <Button type="submit" disabled={unitSave.isPending}>
              {unitSave.isPending?"A guardar...":"Guardar unidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={serviceDialog} onOpenChange={value=>{if(!serviceSave.isPending)setServiceDialog(value);}}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{serviceDraft.id?"Editar serviço":"Novo serviço clínico"}</DialogTitle>
          <DialogDescription>
            Duração de 5–480 minutos; preço e moeda são opcionais, mas devem ser indicados em conjunto.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitService}>
          <div className="space-y-1.5">
            <Label htmlFor="catalog-service-name">Nome</Label>
            <Input id="catalog-service-name" required maxLength={160} value={serviceDraft.name}
              onChange={e=>setServiceDraft(current=>({
                ...current,name:e.target.value,
                ...(!current.id?{slug:toSlug(e.target.value)}:{}),
              }))}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catalog-service-slug">Código interno</Label>
            <Input id="catalog-service-slug" required maxLength={180}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={serviceDraft.slug}
              onChange={e=>setServiceDraft({...serviceDraft,slug:e.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catalog-service-duration">Duração (minutos)</Label>
            <Input id="catalog-service-duration" required type="number" min={5} max={480}
              step={1} value={serviceDraft.duration}
              onChange={e=>setServiceDraft({...serviceDraft,duration:e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-service-price">Preço (opcional)</Label>
              <Input id="catalog-service-price" type="number" min={0} step="0.01"
                placeholder="Ex.: 1500.00" value={serviceDraft.price}
                onChange={e=>setServiceDraft({...serviceDraft,price:e.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catalog-service-currency">Moeda ISO</Label>
              <Input id="catalog-service-currency" maxLength={3} pattern="[A-Za-z]{3}"
                placeholder="Ex.: MZN" value={serviceDraft.currencyCode}
                onChange={e=>setServiceDraft({
                  ...serviceDraft,currencyCode:e.target.value.toUpperCase(),
                })}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={()=>setServiceDialog(false)}>Cancelar</Button>
            <Button type="submit" disabled={serviceSave.isPending}>
              {serviceSave.isPending?"A guardar...":"Guardar serviço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={pending!==null}
      onOpenChange={value=>{if(!value&&!status.isPending)setPending(null);}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pending?.activate?"Reactivar":"Desactivar"}
            {pending?.kind==="unit"?" unidade":" serviço"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.activate
              ?"Este registo voltará a estar disponível no catálogo da clínica."
              :"A operação pode ser recusada se existirem associações profissionais ou marcações activas. O histórico não será apagado."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={status.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={status.isPending}
            onClick={e=>{e.preventDefault();if(pending)status.mutate(pending);}}>
            {status.isPending?"A actualizar...":"Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>;
}
