import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Shield, UserRound } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { me } from "@/lib/clinicflow-api";

export default function InternDashboard(){
  const account=useQuery({queryKey:["intern-profile"],queryFn:me,staleTime:30_000});
  return <DashboardLayout>
    <section className="max-w-3xl mx-auto p-5 md:p-8 space-y-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Área do interno</p>
      <h1 className="text-2xl md:text-3xl font-bold">
        {account.data?"Bem-vindo, "+account.data.displayName:"Área de formação"}
      </h1>
      <div className="border rounded-xl bg-card p-6 md:p-8 space-y-5">
        <span className="p-3 rounded-xl bg-primary/10 inline-flex text-primary">
          <Shield className="w-7 h-7"/>
        </span>
        <h2 className="font-semibold text-xl">Acesso clínico supervisionado pendente</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          O ClinicFlow ainda não definiu o vínculo de supervisão e as permissões de acesso
          dos internos a pacientes, consultas e relatórios. Por isso, este painel
          não apresenta registos clínicos nem permite alterá-los.
        </p>
        <div className="flex gap-3 flex-wrap pt-2">
          <Button asChild variant="outline">
            <Link to="/perfil"><UserRound className="h-4 w-4 mr-2"/> O meu perfil</Link>
          </Button>
        </div>
      </div>
      <div className="border rounded-lg bg-muted/30 p-4 flex gap-3">
        <BookOpen className="w-5 h-5 text-muted-foreground shrink-0"/>
        <p className="text-xs text-muted-foreground">
          A formação, a supervisão e o acesso delegado serão activados
          apenas depois de definidas as regras de autorização e auditoria.
        </p>
      </div>
      {account.isError&&<p role="alert" className="text-sm text-destructive">
        Não foi possível consultar o perfil.
      </p>}
    </section>
  </DashboardLayout>;
}
