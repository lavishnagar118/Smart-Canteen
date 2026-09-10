import {
  ArrowRight,
  CheckCircle2,
  CookingPot,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import GoogleIcon from "../components/GoogleIcon";
import PageContainer from "../components/PageContainer";
import { useAuth } from "../context/AuthContext";

const ENTRY_ROLES = [
  {
    id: "CUSTOMER",
    label: "Order Food",
    kicker: "Customer Portal",
    description: "Browse menu, place orders & track pickup live",
    icon: ShoppingBag,
    demoEmail: "demo.customer@smartcanteen.local",
    demoPassword: "DemoPassword123!",
    badge: "Students & Diners",
  },
  {
    id: "STAFF",
    label: "Kitchen Staff",
    kicker: "Kitchen / Operations",
    description: "Live ticket stream, prep status & order handoffs",
    icon: CookingPot,
    demoEmail: "demo.staff@smartcanteen.local",
    demoPassword: "DemoPassword123!",
    badge: "KDS Workspace",
  },
  {
    id: "ADMIN",
    label: "Canteen Admin",
    kicker: "Management / Administration",
    description: "Locations, dynamic QRs, catalog & analytics",
    icon: Store,
    demoEmail: "demo.admin@smartcanteen.local",
    demoPassword: "DemoPassword123!",
    badge: "System Governance",
  },
];

export function Login() {
  return <AuthForm mode="login" />;
}

export function Register() {
  return <AuthForm mode="register" />;
}

function AuthForm({ mode }) {
  const isRegister = mode === "register";
  const { login, loginWithGoogle, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedRole, setSelectedRole] = useState("CUSTOMER");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const activeEntry = ENTRY_ROLES.find((r) => r.id === selectedRole) || ENTRY_ROLES[0];

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setError("");
    setGoogleError("");
  };

  const handleFillDemo = (role) => {
    setForm((current) => ({
      ...current,
      email: role.demoEmail,
      password: role.demoPassword,
    }));
    setError("");
  };

  // Authoritative redirection: ALWAYS determined by backend user role, NEVER by client tab selection
  const handleAuthRedirect = (user) => {
    const backendRole = user?.role;
    if (backendRole === "STAFF" || backendRole === "ADMIN") {
      navigate("/admin", { replace: true });
    } else {
      navigate(location.state?.from || "/", { replace: true });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = isRegister
        ? await register(form)
        : await login({ email: form.email, password: form.password });
      handleAuthRedirect(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError("");
    setGoogleError("");
    try {
      const result = await loginWithGoogle();
      handleAuthRedirect(result.user);
    } catch (requestError) {
      setGoogleError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="flex min-h-[calc(100vh-7rem)] items-center py-6 sm:py-10">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        {/* Top Header Banner */}
        <div className="border-b border-slate-100 bg-slate-900 px-6 py-7 text-white sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 font-black text-slate-950 shadow-md">
                SC
              </span>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">
                  Smart Canteen<span className="text-teal-400">.</span>
                </h1>
                <p className="text-xs text-slate-400">
                  Operations & Digital Ordering System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-teal-300">
              <ShieldCheck size={14} />
              <span>Role-governed entry point</span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {!isRegister && (
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Select Application Interface</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                    Choose your entry point
                  </h2>
                </div>
                <span className="hidden text-xs text-slate-400 sm:inline-block">
                  Backend verifies actual role
                </span>
              </div>

              {/* Three Professional Role Cards */}
              <div
                className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Application Role Interfaces"
              >
                {ENTRY_ROLES.map((role) => {
                  const isSelected = selectedRole === role.id;
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleRoleSelect(role.id)}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-teal-700 bg-teal-50/60 ring-2 ring-teal-600/30 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              isSelected
                                ? "bg-teal-700 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <Icon size={18} />
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              isSelected
                                ? "bg-teal-200/70 text-teal-900"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {role.badge}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-400">
                          {role.kicker}
                        </p>
                        <h3 className="mt-0.5 text-base font-black text-slate-900">
                          {role.label}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {role.description}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="mt-3 flex items-center gap-1 border-t border-teal-200/60 pt-2 text-[11px] font-black text-teal-800">
                          <CheckCircle2 size={13} />
                          <span>Active entry mode</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Demo Fill Helper Chip */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600 border border-slate-200/60">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles size={14} className="text-teal-700" />
                  <span>
                    Demo account for <b>{activeEntry.label}</b>:{" "}
                    <code className="rounded bg-white px-1.5 py-0.5 border border-slate-200 font-mono text-[11px]">
                      {activeEntry.demoEmail}
                    </code>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleFillDemo(activeEntry)}
                  className="font-bold text-teal-700 hover:text-teal-800 hover:underline"
                >
                  Fill credentials
                </button>
              </div>
            </div>
          )}

          {/* Form Header */}
          <div className="border-t border-slate-100 pt-6">
            <p className="eyebrow">
              {isRegister ? "Customer Sign Up" : `${activeEntry.kicker} Authentication`}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {isRegister
                ? "Create your customer account"
                : `Sign in as ${activeEntry.label}`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isRegister
                ? "Save your favorite dishes, track pickup in real time, and skip the counter wait."
                : selectedRole === "CUSTOMER"
                ? "Access today's menu, your order history, and live pickup notifications."
                : selectedRole === "STAFF"
                ? "Kitchen Display System for live orders, ticket pacing, and queue control."
                : "Full system administration, multi-canteen setup, and demand analytics."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {isRegister && (
                <label className="block text-sm font-bold text-slate-800">
                  Full name
                  <input
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={update("name")}
                    placeholder="Jane Doe"
                    className="field"
                  />
                </label>
              )}
              {isRegister && (
                <label className="block text-sm font-bold text-slate-800">
                  Phone number{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    autoComplete="tel"
                    value={form.phone}
                    onChange={update("phone")}
                    placeholder="+91 98765 43210"
                    className="field"
                  />
                </label>
              )}

              <label className="block text-sm font-bold text-slate-800">
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder={
                    selectedRole === "CUSTOMER"
                      ? "your.email@college.edu"
                      : activeEntry.demoEmail
                  }
                  className="field"
                />
              </label>

              <label className="block text-sm font-bold text-slate-800">
                Password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="••••••••••••"
                  className="field"
                />
              </label>

              {error && <ErrorMessage message={error} />}

              <button
                type="submit"
                disabled={submitting}
                className="button-primary w-full justify-center"
              >
                {submitting ? (
                  "Authenticating..."
                ) : isRegister ? (
                  "Create customer account"
                ) : (
                  <>
                    Sign in to {activeEntry.label} <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            {/* Google Login for Customer SSO */}
            <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> or{" "}
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogleLogin}
              className="button-secondary flex w-full items-center justify-center gap-3 text-sm font-bold shadow-sm transition hover:bg-slate-50"
              aria-label="Continue with Google"
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span>{submitting ? "Connecting..." : "Continue with Google"}</span>
            </button>

            {googleError && (
              <div className="mt-3">
                <ErrorMessage message={googleError} />
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
              <LockKeyhole size={14} />
              <span>Backend verifies authenticated role. Client selections do not override authorization.</span>
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <Link className="font-black text-teal-700 hover:underline" to="/login">
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  New diner?{" "}
                  <Link
                    className="font-black text-teal-700 hover:underline"
                    to="/register"
                  >
                    Create a customer account
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
