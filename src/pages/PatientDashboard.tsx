import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, Shield, UserRound } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { me } from "@/lib/clinicflow-api";

export default function PatientDashboard(){
  const account=useQuery({queryKey:["patient-profile"],queryFn:me,staleTime:30_000});
  return <DashboardLayout>
    <section className="max-w-3xl mx-auto p-5 md:p-8 space-y-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Área do paciente</p>
      <h1 className="text-2xl md:text-3xl font-bold">
        {account.data?"Bem-vindo, "+account.data.displayName:"Portal do paciente"}
      </h1>
      <div className="border rounded-xl bg-card p-6 md:p-8 space-y-5">
        <span className="p-3 rounded-xl bg-primary/10 inline-flex text-primary">
          <Shield className="h-7 w-7"/>
        </span>
        <h2 className="text-xl font-semibold">Acesso aos seus registos em preparação</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ainda não está implementada a associação verificada entre a sua conta
          e a ficha clínica do paciente. Por segurança, não são mostradas consultas,
          resultados ou relatórios de demonstração como se fossem seus.
        </p>
        <Button variant="outline" asChild>
          <Link to="/perfil"><UserRound className="h-4 w-4 mr-2"/> Gerir o meu perfil</Link>
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-5 space-y-2">
          <CalendarDays className="w-5 h-5 text-muted-foreground"/>
          <h3 className="font-medium">As minhas consultas</h3>
          <p className="text-xs text-muted-foreground">Ainda indisponível: vínculo de identidade pendente.</p>
        </div>
        <div className="border rounded-lg p-5 space-y-2">
          <FileText className="w-5 h-5 text-muted-foreground"/>
          <h3 className="font-medium">Os meus relatórios</h3>
          <p className="text-xs text-muted-foreground">Acesso dependente de política de divulgação clínica.</p>
        </div>
      </div>
      {account.isError&&<p role="alert" className="text-sm text-destructive">
        Não foi possível consultar o perfil.
      </p>}
      <p className="text-xs text-muted-foreground">
        A página pública de agendamento existente é uma demonstração,
        não regista consultas reais.
      </p>
    </section>
  </DashboardLayout>;
}
