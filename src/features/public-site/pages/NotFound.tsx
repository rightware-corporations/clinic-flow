import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <img src="/med-clinica-mark.svg" alt="MED Clinica" className="mx-auto mb-6 h-16 w-16 rounded-2xl object-contain shadow-sm" />
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Erro 404</p>
        <h1 className="mb-4 text-3xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mb-8 text-muted-foreground">
          A página que procura não existe ou foi movida. Pode voltar ao início e continuar a navegação.
        </p>
        <Button asChild className="medical-gradient border-0">
          <Link to="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
