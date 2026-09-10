import { ClipboardList, Home, UserRound, Utensils } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/menu", label: "Menu", icon: Utensils },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export default function BottomNavigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-8px_25px_rgba(36,48,56,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md justify-around">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                isActive ? "bg-teal-50 text-teal-800" : "text-slate-400"
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
