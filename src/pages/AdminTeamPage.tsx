import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MailPlus, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
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
  createInvitation, listInvitations, revokeInvitation,
  type CreatedInvitation, type InvitationRole,
} from "@/lib/clinicflow-api";

const roles: {value:InvitationRole;label:string;description:string}[] = [
  {value:"RECEPTION",label:"Recepção",description:"Pacientes e marcações administrativas"},
  {value:"PRACTITIONER",label:"Profissional clínico",description:"Agenda e documentação clínica própria"},
  {value:"INTERN",label:"Interno",description:"Acesso restrito; sem conteúdo clínico neste core"},
];

export default function AdminTeamPage(){
  const queryClient=useQueryClient();
  const [open,setOpen]=useState(false);
  const [created,setCreated]=useState<CreatedInvitation|null>(null);
  const [form,setForm]=useState<{email:string;displayName:string;role:InvitationRole}>({
    email:"",displayName:"",role:"RECEPTION",
  });

  const invitations=useQuery({
    queryKey:["team-invitations"],
    queryFn:listInvitations,
    staleTime:0,
  });
  const refresh=()=>queryClient.invalidateQueries({queryKey:["team-invitations"]});
  const create=useMutation({
    mutationFn:createInvitation,
    onSuccess:value=>{
      setCreated(value);setOpen(false);
      setForm({email:"",displayName:"",role:"RECEPTION"});
      void refresh();
      toast.success("Convite criado. O link é apresentado uma única vez.");
    },
    onError:(error:Error)=>{
      toast.error(error.message.includes("409")
        ?"Já existe uma adesão ou convite activo para este email."
        :"Não foi possível criar o convite.");
    },
  });
  const revoke=useMutation({
    mutationFn:revokeInvitation,
    onSuccess:()=>{toast.success("Convite revogado");void refresh();},
    onError:()=>toast.error("Não foi possível revogar este convite."),
  });

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!create.isPending)create.mutate(form);
  }
  function state(invite:{acceptedAt:string|null;revokedAt:string|null;expiresAt:string}){
    if(invite.acceptedAt)return "Aceite";
    if(invite.revokedAt)return "Revogado";
    if(new Date(invite.expiresAt).getTime()<=Date.now())return "Expirado";
    return "Activo";
  }
  async function copyLink(){
    if(!created)return;
    const link=window.location.origin+"/convite#"+encodeURIComponent(created.token);
    try{
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    }catch{
      toast.error("Não foi possível copiar automaticamente. Seleccione o link manualmente.");
    }
  }

  const invitationLink=created
    ? window.location.origin+"/convite#"+encodeURIComponent(created.token)
    : "";

  return <DashboardLayout>
    <section className="max-w-5xl mx-auto p-5 md:p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Identidade & acesso</p>
          <h1 className="text-2xl md:text-3xl font-bold">Equipa e convites</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione recepção, profissionais e internos sem partilhar palavras-passe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={()=>void invitations.refetch()}>
            <RefreshCw className="w-4 h-4"/> Actualizar
          </Button>
          <Button className="gap-2" onClick={()=>setOpen(true)}>
            <UserPlus className="w-4 h-4"/> Novo convite
          </Button>
        </div>
      </header>

      <div className="border rounded-lg bg-muted/30 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0"/>
        <div className="text-sm">
          <p className="font-medium">Princípio de menor privilégio</p>
          <p className="text-xs text-muted-foreground mt-1">
            Convites não podem criar administradores. O token não é guardado em texto simples
            na base de dados e o link só é mostrado imediatamente após a criação.
          </p>
        </div>
      </div>

      {invitations.isLoading&&<p role="status">A carregar convites...</p>}
      {invitations.isError&&<div role="alert" className="border rounded-lg p-5">
        <p>Não foi possível carregar os convites.</p>
        <Button variant="outline" className="mt-3" onClick={()=>void invitations.refetch()}>
          Tentar novamente
        </Button>
      </div>}
      {invitations.data&&<div className="border rounded-xl bg-card divide-y">
        {invitations.data.map(invite=>{
          const status=state(invite);
          return <div key={invite.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{invite.displayName}</p>
                <Badge variant={status==="Activo"?"default":"secondary"}>{status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{invite.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {roles.find(r=>r.value===invite.role)?.label??invite.role}
                {" · expira "}{new Date(invite.expiresAt).toLocaleString("pt-MZ")}
              </p>
            </div>
            {status==="Activo"&&<Button size="sm" variant="outline"
              disabled={revoke.isPending}
              onClick={()=>revoke.mutate(invite.id)}>Revogar</Button>}
          </div>;
        })}
        {invitations.data.length===0&&<div className="p-12 text-center text-muted-foreground">
          <MailPlus className="w-10 h-10 mx-auto mb-3 opacity-40"/>
          Nenhum convite emitido.
        </div>}
      </div>}
    </section>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar membro da clínica</DialogTitle>
          <DialogDescription>
            O convite expira automaticamente. Administradores não podem ser criados por este fluxo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nome</Label>
            <Input id="invite-name" required maxLength={160} value={form.displayName}
              onChange={e=>setForm({...form,displayName:e.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" required type="email" maxLength={254} value={form.email}
              onChange={e=>setForm({...form,email:e.target.value})}/>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Papel</legend>
            {roles.map(role=><label key={role.value}
              className={"block border rounded-lg p-3 cursor-pointer "+
                (form.role===role.value?"border-primary bg-primary/5":"")}>
              <input className="mr-2" type="radio" name="role" value={role.value}
                checked={form.role===role.value}
                onChange={()=>setForm({...form,role:role.value})}/>
              <span className="font-medium text-sm">{role.label}</span>
              <span className="block text-xs text-muted-foreground ml-6">{role.description}</span>
            </label>)}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending?"A criar...":"Criar convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={created!==null} onOpenChange={value=>{if(!value)setCreated(null);}}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Link de convite criado</DialogTitle>
          <DialogDescription>
            Copie este link agora. O ClinicFlow guarda apenas o hash do token e não conseguirá
            voltar a mostrar exactamente este link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input readOnly value={invitationLink} aria-label="Link do convite"/>
          <Button className="w-full gap-2" onClick={()=>void copyLink()}>
            <Copy className="w-4 h-4"/> Copiar link
          </Button>
          <p className="text-xs text-muted-foreground">
            Envie-o por um canal apropriado ao destinatário. Entrega automática por email ainda
            não está activada neste ambiente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </DashboardLayout>;
}
