import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptInvitation, inspectInvitation,
} from "@/lib/clinicflow-api";

export default function AcceptInvitationPage(){
  const [token,setToken]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [existingPassword,setExistingPassword]=useState("");
  const [accepted,setAccepted]=useState(false);

  useEffect(()=>{
    const raw=window.location.hash.startsWith("#")
      ? decodeURIComponent(window.location.hash.slice(1)) : "";
    setToken(raw);
    if(window.location.hash){
      window.history.replaceState(null,"",window.location.pathname+window.location.search);
    }
  },[]);

  const invitation=useQuery({
    queryKey:["public-invitation",token],
    queryFn:()=>inspectInvitation(token),
    enabled:Boolean(token),
    retry:false,
  });
  const accept=useMutation({
    mutationFn:()=>{
      if(!invitation.data)throw new Error("INVITATION_REQUIRED");
      if(invitation.data.existingAccount){
        if(!existingPassword)throw new Error("CURRENT_PASSWORD_REQUIRED");
        return acceptInvitation(token,{existingAccountPassword:existingPassword});
      }
      if(password.length<14)throw new Error("PASSWORD_TOO_SHORT");
      if(password!==confirm)throw new Error("PASSWORD_MISMATCH");
      return acceptInvitation(token,{password});
    },
    onSuccess:()=>{setAccepted(true);setPassword("");setConfirm("");setExistingPassword("");},
  });

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!accept.isPending)accept.mutate();
  }
  function errorMessage(){
    const error=accept.error;
    if(!(error instanceof Error))return "";
    if(error.message==="CURRENT_PASSWORD_REQUIRED")return "Introduza a palavra-passe actual da sua conta.";
    if(error.message==="PASSWORD_TOO_SHORT")return "A palavra-passe deve ter pelo menos 14 caracteres.";
    if(error.message==="PASSWORD_MISMATCH")return "As palavras-passe não coincidem.";
    if(error.message.includes("401"))return "A palavra-passe da conta existente está incorrecta.";
    if(error.message.includes("410"))return "Este convite expirou, foi revogado ou já foi utilizado.";
    return "Não foi possível aceitar o convite.";
  }

  return <main className="min-h-screen bg-background grid place-items-center p-5">
    <section className="w-full max-w-md border rounded-2xl bg-card p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <img src="/med-clinica-mark.svg" alt="" className="w-11 h-11"/>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">ClinicFlow</p>
          <h1 className="text-xl font-bold">Aceitar convite</h1>
        </div>
      </div>

      {!token&&<div role="alert" className="space-y-3">
        <p>O link de convite está incompleto.</p>
        <Link className="text-sm text-primary underline" to="/login">Ir para o login</Link>
      </div>}
      {token&&invitation.isLoading&&<p role="status">A verificar convite...</p>}
      {token&&invitation.isError&&<div role="alert" className="space-y-3">
        <p>Este convite não está disponível. Pode ter expirado, sido revogado ou já utilizado.</p>
        <Link className="text-sm text-primary underline" to="/login">Ir para o login</Link>
      </div>}

      {invitation.data&&!accepted&&<>
        <div className="border rounded-lg p-4 space-y-1">
          <p className="font-semibold">{invitation.data.clinicName}</p>
          <p className="text-sm">{invitation.data.displayName}</p>
          <p className="text-sm text-muted-foreground">{invitation.data.email}</p>
          <p className="text-xs text-muted-foreground">
            Papel atribuído: {invitation.data.role}
          </p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary"/>
          <p>
            O papel foi definido pela administração e não pode ser alterado nesta página.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {invitation.data.existingAccount?<div className="space-y-1.5">
            <Label htmlFor="existing-password">Palavra-passe actual</Label>
            <Input id="existing-password" type="password" autoComplete="current-password"
              value={existingPassword} onChange={e=>setExistingPassword(e.target.value)} required/>
            <p className="text-xs text-muted-foreground">
              Já existe uma conta ClinicFlow com este email. A palavra-passe não será redefinida.
            </p>
          </div>:<>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Criar palavra-passe</Label>
              <Input id="new-password" type="password" autoComplete="new-password"
                minLength={14} maxLength={128} value={password}
                onChange={e=>setPassword(e.target.value)} required/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar palavra-passe</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password"
                minLength={14} maxLength={128} value={confirm}
                onChange={e=>setConfirm(e.target.value)} required/>
            </div>
          </>}
          {accept.isError&&<p role="alert" className="text-sm text-destructive">{errorMessage()}</p>}
          <Button type="submit" className="w-full gap-2" disabled={accept.isPending}>
            <KeyRound className="w-4 h-4"/>
            {accept.isPending?"A activar...":"Activar acesso"}
          </Button>
        </form>
      </>}

      {accepted&&<div className="text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto"/>
        <div>
          <h2 className="font-semibold text-lg">Acesso activado</h2>
          <p className="text-sm text-muted-foreground">
            A adesão à clínica foi criada. Pode iniciar sessão com o mesmo email.
          </p>
        </div>
        <Button asChild className="w-full"><Link to="/login">Ir para o login</Link></Button>
      </div>}
    </section>
  </main>;
}
