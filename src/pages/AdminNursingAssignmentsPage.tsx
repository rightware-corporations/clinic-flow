import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { activeTenantId, listNursingTeam, listClinicUnits, setNursingUnits,
  type NursingTeamMember } from "@/lib/clinicflow-api";

function UnitEditor({nurse,available,onDone}:{nurse:NursingTeamMember;
  available:{id:string;name:string}[];onDone:()=>void}){
  const [selected,setSelected]=useState<string[]>(nurse.units.map(u=>u.id));
  const save=useMutation({
    mutationFn:()=>setNursingUnits(nurse.userId,nurse.version,selected),
    onSuccess:()=>{toast.success("Unidades actualizadas");onDone();},
    onError:()=>{toast.error("Não foi possível guardar. Actualize a lista e reveja as atribuições.");onDone();},
  });
  return <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
    <p className="text-sm font-medium">Atribuir unidades a {nurse.displayName}</p>
    <p className="text-xs text-muted-foreground">A ausência de atribuições mantém o acesso operacional bloqueado.</p>
    {available.map(unit=><label key={unit.id} className="flex items-center gap-3 text-sm">
      <input type="checkbox" checked={selected.includes(unit.id)}
        onChange={e=>setSelected(old=>e.target.checked?[...old,unit.id]:old.filter(id=>id!==unit.id))}/>
      {unit.name}
    </label>)}
    {available.length===0&&<p className="text-sm text-muted-foreground">Sem unidades activas.</p>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={save.isPending} onClick={()=>save.mutate()}>
        {save.isPending?"A guardar...":"Guardar unidades"}
      </Button>
      <Button size="sm" variant="outline" disabled={save.isPending} onClick={onDone}>Cancelar</Button>
    </div>
  </div>;
}
export default function AdminNursingAssignmentsPage(){
  const tenant=activeTenantId(),cache=useQueryClient();
  const [editing,setEditing]=useState<string|null>(null);
  const nurses=useQuery({queryKey:["admin-nursing-team",tenant],queryFn:listNursingTeam});
  const units=useQuery({queryKey:["clinic-units",tenant],queryFn:listClinicUnits});
  const refresh=()=>{void cache.invalidateQueries({queryKey:["admin-nursing-team",tenant]});
    void cache.invalidateQueries({queryKey:["clinic-units",tenant]});};
  return <DashboardLayout><section className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link to="/equipa" className="text-sm text-muted-foreground underline">Voltar à equipa</Link>
        <h1 className="mt-2 text-2xl font-bold">Unidades de enfermagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atribuições mínimas para activar o portal operacional dos enfermeiros.
        </p>
      </div>
      <Button variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4"/>Actualizar</Button>
    </header>
    <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <ShieldCheck className="h-5 w-5 shrink-0 text-primary"/>
      <p>Convide primeiro um enfermeiro através de Equipa e convites. O acesso aos pacientes
        depende das unidades explicitamente atribuídas; esta página não concede acesso aos relatórios.</p>
    </div>
    {(nurses.isLoading||units.isLoading)&&<p role="status">A carregar equipa e unidades...</p>}
    {(nurses.isError||units.isError)&&<div role="alert" className="rounded-lg border p-4">
      <p>Não foi possível validar a equipa ou as unidades. As alterações estão indisponíveis.</p>
      <Button variant="outline" className="mt-3" onClick={refresh}>Tentar novamente</Button>
    </div>}
    {nurses.data&&units.data&&<div className="space-y-3">
      {nurses.data.length===0&&<p className="rounded-lg border p-6 text-sm text-muted-foreground">
        Ainda não existem enfermeiros com convite aceite nesta clínica.
      </p>}
      {nurses.data.map(nurse=><article key={nurse.userId} className="space-y-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{nurse.displayName}</h2>
            <p className="text-sm text-muted-foreground">{nurse.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nurse.units.length
                ? nurse.units.map(u=>u.name).join(", "):"Nenhuma unidade atribuída"}
            </p>
          </div>
          {editing!==nurse.userId&&<Button size="sm" variant="outline"
            onClick={()=>setEditing(nurse.userId)}>Editar unidades</Button>}
        </div>
        {editing===nurse.userId&&<UnitEditor key={nurse.userId+"-"+nurse.version}
          nurse={nurse} available={units.data.filter(unit=>unit.active)}
          onDone={()=>{setEditing(null);refresh();}}/>}
      </article>)}
    </div>}
  </section></DashboardLayout>;
}
