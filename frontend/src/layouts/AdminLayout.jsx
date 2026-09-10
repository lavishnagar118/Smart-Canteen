import { BarChart3, ClipboardList, LayoutDashboard, Menu as MenuIcon, Utensils, X, Store, LineChart, Wifi, WifiOff, RefreshCw, LogOut, Users, Sparkles } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { subscribeConnectionStatus } from "../services/socket";
import StaffAIAssistant from "../components/ai/StaffAIAssistant";
import AdminAIAssistant from "../components/ai/AdminAIAssistant";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/queue", label: "Queue", icon: BarChart3 },
  { to: "/admin/menu", label: "Menu", icon: Utensils },
];

const adminOnlyLinks = [
  { to: "/admin/staff", label: "Staff", icon: Users },
  { to: "/admin/canteens", label: "Canteens", icon: Store },
  { to: "/admin/analytics", label: "Analytics", icon: LineChart },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [adminAiOpen, setAdminAiOpen] = useState(false);
  const [connection, setConnection] = useState("offline");
  const visibleLinks = [...links, ...(user?.role === "ADMIN" ? adminOnlyLinks : [])];
  const activeLabel = visibleLinks
    .find((link) => location.pathname === link.to || (link.to !== "/admin" && location.pathname.startsWith(link.to)))?.label || "Dashboard";
  useEffect(() => subscribeConnectionStatus(setConnection), []);
  const navigation = (
    <nav className="space-y-1.5" aria-label="Operations navigation">
      {visibleLinks.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `admin-nav-link ${isActive ? "admin-nav-link-active" : ""}`}>
          <Icon size={18} /> {label}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="admin-shell min-h-screen lg:flex">
      <aside className="admin-sidebar hidden w-64 shrink-0 lg:block">
        <NavBrand />
        <div className="mt-10">{navigation}</div>
        <div className="admin-sidebar-footer">
          <div className="admin-connection"><ConnectionIcon status={connection} /><span>{connectionLabel(connection)}</span></div>
          <p>Kitchen operations workspace</p>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setOpen(false)}><aside className="admin-sidebar h-full w-72" onClick={(e) => e.stopPropagation()}><NavBrand onClose={() => setOpen(false)} /><div className="mt-10">{navigation}</div></aside></div>}
      <div className="min-w-0 flex-1">
        <header className="admin-header sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button type="button" className="icon-button lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><MenuIcon size={20} /></button>
            <div><p className="admin-kicker">Operations control</p><h1 className="text-lg font-black text-slate-950">{activeLabel}</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              aria-label="Open Kitchen Assistant"
              className="inline-flex items-center gap-2 rounded-xl border border-teal-700/30 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 shadow-2xs transition hover:bg-teal-100 hover:border-teal-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Sparkles size={14} className="text-teal-600" />
              <span className="hidden sm:inline">Kitchen Assistant</span>
              <span className="sm:hidden">AI Assistant</span>
            </button>

            {user?.role === "ADMIN" && (
              <button
                type="button"
                onClick={() => setAdminAiOpen(true)}
                aria-label="Open Analytics Assistant"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-700/30 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 shadow-2xs transition hover:bg-cyan-100 hover:border-cyan-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <LineChart size={14} className="text-cyan-600" />
                <span className="hidden sm:inline">Analytics Assistant</span>
                <span className="sm:hidden">Analytics AI</span>
              </button>
            )}

            <div className="hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex"><ConnectionIcon status={connection} /><span>{connectionLabel(connection)}</span></div>
            <div className="hidden border-l border-slate-200 pl-3 text-right sm:block"><p className="text-sm font-bold text-slate-900">{user?.name || "Operator"}</p><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{user?.role}</p></div>
            <button type="button" onClick={logout} className="icon-button text-slate-500 hover:text-red-600" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </header>
        <main className="admin-main mx-auto max-w-[1500px]"><Outlet /></main>
        <StaffAIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
        {user?.role === "ADMIN" && (
          <AdminAIAssistant isOpen={adminAiOpen} onClose={() => setAdminAiOpen(false)} />
        )}
      </div>
    </div>
  );
}

function NavBrand({ onClose }) {
  return <div className="flex items-center justify-between"><div className="flex items-center gap-3 text-lg font-black text-white"><span className="brand-mark"><Utensils size={17} /></span><span>Smart Canteen<span className="text-cyan-300">.</span></span></div>{onClose && <button type="button" onClick={onClose} className="icon-button text-slate-300 hover:text-white" aria-label="Close navigation"><X size={20} /></button>}</div>;
}

function ConnectionIcon({ status }) {
  if (status === "live") return <Wifi size={15} className="text-emerald-500" />;
  if (status === "reconnecting") return <RefreshCw size={15} className="animate-spin text-amber-500" />;
  return <WifiOff size={15} className="text-slate-400" />;
}

function connectionLabel(status) {
  return status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline";
}
