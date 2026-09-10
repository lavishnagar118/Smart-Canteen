import { Link, NavLink } from "react-router-dom";
import { ClipboardList, Home, LogIn, LogOut, Menu as MenuIcon, ShoppingBag, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f8f6]/95 backdrop-blur">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-3 font-black tracking-tight text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-xs font-black text-white">SC</span>
          <span className="hidden sm:block">Smart Canteen</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Customer navigation">
          {[
            ["/", "Home", Home],
            ["/menu", "Menu", MenuIcon],
            ["/orders", "Orders", ClipboardList],
          ].map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/cart" aria-label={`Cart${itemCount > 0 ? `, ${itemCount} items` : ""}`} className="relative rounded-xl p-2.5 text-slate-700 hover:bg-white">
            <ShoppingBag size={21} />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-coral-600 px-1 text-center text-xs font-bold text-white" style={{ backgroundColor: "#e66f51" }}>
                {itemCount}
              </span>
            )}
          </Link>
          {isAuthenticated ? (
            <Link to="/profile" aria-label="Profile" className="hidden rounded-xl p-2.5 text-slate-700 hover:bg-white sm:block"><UserRound size={20} /></Link>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-bold text-white">
              <LogIn size={17} aria-hidden="true" /><span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
