import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Stethoscope, Pencil, UserRound, RefreshCw, BookOpen } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  activeTenantId, addProfessional, addSpecialty, editProfessional, editSpecialty,
  listClinicServices, listClinicUnits, listEligibleProfessionals, listProfessionals, listSpecialties,
  setProfessionalActive, setSpecialtyActive,
  type Professional, type ProfessionalInput, type Specialty,
} from "@/lib/clinicflow-api";

type SpecialtyDraft = { id?: string; name: string; code: string };
type PendingAction =
  | {kind: "professional"; target: Professional; nextActive: boolean}
  | {kind: "specialty"; target: Specialty; nextActive: boolean};

const blankProfessional: ProfessionalInput = {
  userId: "", specialtyId: null, professionalTitle: null, licenseNumber: null,
  bio: null, unitIds: [], serviceIds: [],
};
const normalizeCode = (name: string) => name.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function selectedIds(current: string[], id: string, checked: boolean): string[] {
  return checked ? [...new Set([...current, id])] : current.filter(x => x !== id);
}

export default function AdminProfessionalsPage() {
  const queryClient = useQueryClient();
  const tenant = activeTenantId(); // This route is mounted only after verified membership.
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfessionalInput>(blankProfessional);
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [specialtyDraft, setSpecialtyDraft] = useState<SpecialtyDraft>({name:"",code:""});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const catalog = useQuery({
    queryKey: ["admin-professional-catalog", tenant],
    queryFn: async () => {
      const [profiles, specialties, eligible, units, services] = await Promise.all([
        listProfessionals(), listSpecialties(), listEligibleProfessionals(),
        listClinicUnits(), listClinicServices(),
      ]);
      return {profiles, specialties, eligible, units, services};
    },
    staleTime: 15_000,
  });

  const refresh = () => queryClient.invalidateQueries({
    queryKey: ["admin-professional-catalog", tenant],
  });

  const profileMutation = useMutation({
    mutationFn: ({editing, input}: {editing: boolean; input: ProfessionalInput}) =>
      editing ? editProfessional(input) : addProfessional(input),
    onSuccess: (_profile, args) => {
      toast.success(args.editing ? "Perfil actualizado" : "Profissional registado");
      setProfileOpen(false);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message.includes("409")
      ? "Registo alterado noutra sessão. Recarregue antes de guardar."
      : "Não foi possível guardar o profissional."),
  });

  const specialtyMutation = useMutation({
    mutationFn: (draft: SpecialtyDraft) =>
      draft.id ? editSpecialty(draft.id,{name:draft.name,code:draft.code})
        : addSpecialty({name:draft.name,code:draft.code}),
    onSuccess: () => {
      toast.success("Especialidade guardada");
      setSpecialtyOpen(false);
      void refresh();
    },
    onError: () => toast.error("Não foi possível guardar a especialidade. Verifique se o código já existe."),
  });

  const statusMutation = useMutation({
    mutationFn: async (action: PendingAction): Promise<void> => {
      if (action.kind === "professional") {
        await setProfessionalActive(action.target.userId, action.target.version, action.nextActive);
      } else {
        await setSpecialtyActive(action.target.id, action.nextActive);
      }
    },
    onSuccess: () => {toast.success("Estado actualizado");setPendingAction(null);void refresh();},
    onError: (error: Error) => {
      toast.error(error.message.includes("409")
        ? "A operação tem um conflito ou uma associação inactiva. Actualize a página."
        : "Não foi possível actualizar o estado.");
      setPendingAction(null);
    },
  });

  function newProfile() {
    setProfileEditing(false);
    setProfileDraft(blankProfessional);
    setProfileOpen(true);
  }

  function editProfile(profile: Professional) {
    setProfileEditing(true);
    setProfileDraft({
      userId: profile.userId, specialtyId: profile.specialtyId,
      professionalTitle: profile.professionalTitle, licenseNumber: profile.licenseNumber,
      bio: profile.bio, unitIds: [...profile.unitIds], serviceIds: [...profile.serviceIds],
      version: profile.version,
    });
    setProfileOpen(true);
  }

  function newSpecialty() {
    setSpecialtyDraft({name:"",code:""});
    setSpecialtyOpen(true);
  }

  function editExistingSpecialty(specialty: Specialty) {
    setSpecialtyDraft({id:specialty.id,name:specialty.name,code:specialty.code});
    setSpecialtyOpen(true);
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDraft.userId) {toast.error("Seleccione um membro da clínica.");return;}
    profileMutation.mutate({editing:profileEditing,input:profileDraft});
  }

  function saveSpecialty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    specialtyMutation.mutate(specialtyDraft);
  }

  const data = catalog.data;
  return (
    <DashboardLayout>
      <div className="p-5 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Catálogo clínico</p>
            <h1 className="text-2xl md:text-3xl font-bold">Profissionais e especialidades</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Identidades verificadas; perfis, unidades e serviços configurados por clínica.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void catalog.refetch()}>
            <RefreshCw className="h-4 w-4"/> Actualizar
          </Button>
        </div>

        {catalog.isPending && <p role="status" className="py-10">A carregar catálogo...</p>}
        {catalog.isError && <div role="alert" className="border rounded-lg p-6 space-y-3">
          <p>Não foi possível carregar os dados. Verifique a sessão e a ligação.</p>
          <Button onClick={() => void catalog.refetch()} variant="outline">Tentar novamente</Button>
        </div>}

        {data && <Tabs defaultValue="profiles" className="space-y-5">
          <TabsList>
            <TabsTrigger value="profiles">Profissionais ({data.profiles.length})</TabsTrigger>
            <TabsTrigger value="specialties">Especialidades ({data.specialties.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {data.profiles.filter(p=>p.active).length} perfis activos
              </p>
              <Button className="gap-2" onClick={newProfile}
                disabled={data.eligible.length === 0}>
                <Plus className="w-4 h-4"/> Adicionar profissional
              </Button>
            </div>
            {data.eligible.length === 0 && <p className="text-sm border rounded-md p-3 text-muted-foreground">
              Para adicionar outro profissional, é necessário ter primeiro um membro activo
              com papel PRACTITIONER ou INTERN. O fluxo de convites seguro pertence
              ao próximo módulo de identidade.
            </p>}
            <div className="border rounded-xl divide-y bg-card">
              {data.profiles.map(profile => <div key={profile.userId}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
                <div className="flex gap-3">
                  <span className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    <Stethoscope className="h-5 w-5 text-primary"/>
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{profile.displayName}</p>
                      <Badge variant={profile.active?"default":"secondary"}>
                        {profile.active?"Activo":"Inactivo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{profile.professionalTitle||"Sem título"} · {profile.specialtyName||"Sem especialidade"}</p>
                    <p className="text-xs text-muted-foreground break-all">{profile.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profile.unitIds.length} unidade(s) · {profile.serviceIds.length} serviço(s)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {profile.active && <Button variant="outline" size="sm" className="gap-1"
                    onClick={()=>editProfile(profile)}><Pencil className="h-3.5 w-3.5"/> Editar</Button>}
                  <Button variant={profile.active?"outline":"default"} size="sm"
                    onClick={()=>setPendingAction({kind:"professional",target:profile,nextActive:!profile.active})}>
                    {profile.active?"Desactivar":"Reactivar"}
                  </Button>
                </div>
              </div>)}
              {data.profiles.length===0 && <div className="p-10 text-center text-sm text-muted-foreground">
                <UserRound className="w-9 h-9 mx-auto mb-2 opacity-40"/>
                Ainda não existem perfis profissionais nesta clínica.
              </div>}
            </div>
          </TabsContent>

          <TabsContent value="specialties" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Especialidades desta clínica</p>
              <Button className="gap-2" onClick={newSpecialty}>
                <Plus className="w-4 h-4"/> Nova especialidade
              </Button>
            </div>
            <div className="border rounded-xl divide-y bg-card">
              {data.specialties.map(specialty => <div key={specialty.id}
                className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground"/>
                  <div><p className="font-medium">{specialty.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{specialty.code}</p></div>
                  <Badge variant={specialty.active?"default":"secondary"}>
                    {specialty.active?"Activa":"Inactiva"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {specialty.active && <Button variant="outline" size="sm"
                    onClick={()=>editExistingSpecialty(specialty)}>Editar</Button>}
                  <Button size="sm" variant={specialty.active?"outline":"default"}
                    onClick={()=>setPendingAction({kind:"specialty",target:specialty,nextActive:!specialty.active})}>
                    {specialty.active?"Desactivar":"Reactivar"}
                  </Button>
                </div>
              </div>)}
              {data.specialties.length===0 && <p className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma especialidade registada.
              </p>}
            </div>
          </TabsContent>
        </Tabs>}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{profileEditing?"Editar profissional":"Adicionar profissional"}</DialogTitle>
            <DialogDescription>Um perfil utiliza uma conta já pertencente à clínica.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="professional-user">Conta do profissional</Label>
              {profileEditing ? <p className="rounded-md bg-muted p-2.5 text-sm">
                {data?.profiles.find(p=>p.userId===profileDraft.userId)?.displayName}
              </p> : <Select value={profileDraft.userId||undefined}
                onValueChange={userId=>setProfileDraft({...profileDraft,userId})}>
                <SelectTrigger id="professional-user"><SelectValue placeholder="Escolher membro elegível"/></SelectTrigger>
                <SelectContent>{data?.eligible.map(member=><SelectItem key={member.userId} value={member.userId}>
                  {member.displayName} · {member.role}
                </SelectItem>)}</SelectContent>
              </Select>}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="professional-specialty">Especialidade</Label>
                <Select value={profileDraft.specialtyId??"none"}
                  onValueChange={id=>setProfileDraft({...profileDraft,specialtyId:id==="none"?null:id})}>
                  <SelectTrigger id="professional-specialty"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem especialidade</SelectItem>
                    {data?.specialties.filter(s=>s.active||s.id===profileDraft.specialtyId)
                      .map(s=><SelectItem value={s.id} key={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="professional-title">Título profissional</Label>
                <Input id="professional-title" maxLength={120} value={profileDraft.professionalTitle??""}
                  onChange={e=>setProfileDraft({...profileDraft,professionalTitle:e.target.value||null})}
                  placeholder="Ex.: Médico, Fisioterapeuta"/>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="professional-license">Número de licença (quando aplicável)</Label>
                <Input id="professional-license" maxLength={120} value={profileDraft.licenseNumber??""}
                  onChange={e=>setProfileDraft({...profileDraft,licenseNumber:e.target.value||null})}/>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="professional-bio">Descrição profissional</Label>
                <textarea id="professional-bio" maxLength={1000} rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={profileDraft.bio??""}
                  onChange={e=>setProfileDraft({...profileDraft,bio:e.target.value||null})}/>
              </div>
            </div>

            <fieldset className="border rounded-lg p-4 space-y-3">
              <legend className="font-medium px-2 text-sm">Unidades de atendimento</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                {data?.units.filter(u=>u.active||profileDraft.unitIds.includes(u.id)).map(unit=>
                  <div className="flex items-center gap-2" key={unit.id}>
                    <Checkbox id={"unit-"+unit.id} disabled={!unit.active && !profileDraft.unitIds.includes(unit.id)}
                      checked={profileDraft.unitIds.includes(unit.id)}
                      onCheckedChange={checked=>setProfileDraft({...profileDraft,
                        unitIds:selectedIds(profileDraft.unitIds,unit.id,checked===true)})}/>
                    <Label htmlFor={"unit-"+unit.id} className="font-normal">
                      {unit.name}{!unit.active?" (inactiva)":""}
                    </Label>
                  </div>)}
                {data?.units.length===0 && <p className="text-xs text-muted-foreground">Crie uma unidade clínica primeiro.</p>}
              </div>
            </fieldset>
            <fieldset className="border rounded-lg p-4 space-y-3">
              <legend className="font-medium px-2 text-sm">Serviços autorizados</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                {data?.services.filter(s=>s.active||profileDraft.serviceIds.includes(s.id)).map(service=>
                  <div className="flex items-center gap-2" key={service.id}>
                    <Checkbox id={"service-"+service.id} disabled={!service.active && !profileDraft.serviceIds.includes(service.id)}
                      checked={profileDraft.serviceIds.includes(service.id)}
                      onCheckedChange={checked=>setProfileDraft({...profileDraft,
                        serviceIds:selectedIds(profileDraft.serviceIds,service.id,checked===true)})}/>
                    <Label htmlFor={"service-"+service.id} className="font-normal">
                      {service.name}{!service.active?" (inactivo)":""}
                    </Label>
                  </div>)}
                {data?.services.length===0 && <p className="text-xs text-muted-foreground">Registe serviços primeiro.</p>}
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={()=>setProfileOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending?"A guardar...":"Guardar profissional"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={specialtyOpen} onOpenChange={setSpecialtyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{specialtyDraft.id?"Editar especialidade":"Nova especialidade"}</DialogTitle>
            <DialogDescription>O código é único dentro desta clínica.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSpecialty} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="specialty-name">Nome</Label>
              <Input id="specialty-name" required maxLength={160} value={specialtyDraft.name}
                onChange={e=>setSpecialtyDraft({
                  ...specialtyDraft,name:e.target.value,
                  ...(!specialtyDraft.id?{code:normalizeCode(e.target.value)}:{}),
                })}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="specialty-code">Código</Label>
              <Input id="specialty-code" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={specialtyDraft.code}
                onChange={e=>setSpecialtyDraft({...specialtyDraft,code:e.target.value})}/>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={()=>setSpecialtyOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={specialtyMutation.isPending}>
                {specialtyMutation.isPending?"A guardar...":"Guardar especialidade"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingAction!==null} onOpenChange={open=>{if(!open)setPendingAction(null);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.nextActive?"Reactivar":"Desactivar"} registo?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind==="professional"
                ? "A disponibilidade de agendamento será validada pelo Scheduling Engine quando for implementado."
                : "Uma especialidade associada a profissionais poderá impedir a desactivação."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={statusMutation.isPending}
              onClick={e=>{
                if(!pendingAction)return;
                e.preventDefault();
                statusMutation.mutate(pendingAction);
              }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
