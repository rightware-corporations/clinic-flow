import { useLocation, Link } from "react-router-dom";
import { Home, Search, CalendarDays, User } from "lucide-react";

const items = [
  { label: "Início", icon: Home, href: "/" },
  { label: "Serviços", icon: Search, href: "/servicos" },
  { label: "Agendar", icon: CalendarDays, href: "/agendar" },
  { label: "Perfil", icon: User, href: "/login" },
];

export default function MobileBottomNav() {
  const location = useLocation();
  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const active = location.pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`bottom-nav-item ${active ? "active" : ""}`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
