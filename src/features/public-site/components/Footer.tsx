import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-foreground text-primary-foreground/80 pb-20 md:pb-0">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary-foreground flex items-center justify-center">
                <img src="/med-clinica-mark.svg" alt="MED Clinica" className="w-8 h-8 rounded-md object-contain" />
              </div>
              <span className="text-base font-bold text-primary-foreground">MED Clinica</span>
            </div>
            <p className="text-sm leading-relaxed text-primary-foreground/60">
              Cuidados de saúde premium com tecnologia de ponta e atendimento humanizado.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Serviços</h4>
            <ul className="space-y-2.5">
              {["Consultas", "Exames", "Análises", "Fisioterapia", "Vacinação", "Domicílio"].map((s) => (
                <li key={s}>
                  <Link to="/servicos" className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Clínica</h4>
            <ul className="space-y-2.5">
              {["Sobre nós", "Equipa", "Instalações", "FAQ", "Contacto"].map((s) => (
                <li key={s}>
                  <Link to="/" className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-primary-foreground mb-4">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-primary-foreground/60">
                <Phone className="w-4 h-4 shrink-0" /> 210 000 000
              </li>
              <li className="flex items-center gap-2 text-sm text-primary-foreground/60">
                <Mail className="w-4 h-4 shrink-0" /> geral@medclinica.pt
              </li>
              <li className="flex items-start gap-2 text-sm text-primary-foreground/60">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" /> Av. da Liberdade, 100<br />1250-096 Lisboa
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 text-center text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} MED Clinica. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
