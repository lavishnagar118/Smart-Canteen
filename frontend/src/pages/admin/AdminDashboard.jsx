import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Clock3, CookingPot, CheckCircle2, ListOrdered, PackageCheck, ArrowUpRight, CircleDollarSign } from "lucide-react";
import { getOperationalOrders } from "../../services/adminService";
import { getQueue } from "../../services/queueService";
import { subscribeSocket } from "../../services/socket";
import AdminPageState from "../../components/admin/AdminPageState";
import { Link } from "react-router-dom";

const cards = [
  ["Today's Orders", "today", ClipboardList, "blue"],
  ["Pending Orders", "pending", Clock3, "amber"],
  ["Preparing", "preparing", CookingPot, "violet"],
  ["Ready", "ready", PackageCheck, "emerald"],
  ["Completed", "completed", CheckCircle2, "slate"],
  ["Revenue", "revenue", CircleDollarSign, "cyan"],
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ordersResponse, queueResponse] = await Promise.all([
        getOperationalOrders({ limit: 100 }),
        getQueue(),
      ]);
      const orders = ordersResponse.data.data?.orders || [];
      const queue = queueResponse.data.data?.queue || [];
      const today = new Date().toDateString();
      setData({
        today: orders.filter((order) => new Date(order.createdAt).toDateString() === today).length,
        pending: orders.filter((order) => ["PENDING_PAYMENT", "CONFIRMED"].includes(order.status)).length,
        preparing: orders.filter((order) => ["ACCEPTED", "PREPARING"].includes(order.status)).length,
        ready: orders.filter((order) => order.status === "READY").length,
        completed: orders.filter((order) => order.status === "COMPLETED").length,
        revenue: null,
        queue: queue.length,
        orders,
      });
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const unsubscribers = ["ORDER_STATUS_UPDATED", "QUEUE_UPDATED", "WAIT_TIME_UPDATED"].map((event) => subscribeSocket(event, load));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [load]);
  return <div>
    <div className="admin-page-heading"><div><p className="admin-kicker">Shift overview</p><h2 className="admin-title">Keep service moving.</h2><p className="admin-subtitle">A live snapshot of orders moving through your operation.</p></div><Link to="/admin/orders" className="button-primary"><ClipboardList size={17} /> View all orders</Link></div>
    <AdminPageState loading={loading} error={error} onRetry={load}>{data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, key, Icon, tone]) => <div key={key} className="kpi-card"><div className="flex items-start justify-between"><div><p className="kpi-label">{label}</p><p className="kpi-value">{data[key] === null ? "—" : data[key]}</p></div><span className={`kpi-icon kpi-${tone}`}><Icon size={19} /></span></div>{key === "revenue" && <p className="mt-2 text-xs font-semibold text-slate-400">Available in Analytics</p>}</div>)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
        <section className="admin-panel"><div className="panel-heading"><div><p className="admin-kicker">Live feed</p><h3 className="panel-title">Live orders</h3></div><Link to="/admin/orders" className="text-sm font-bold text-cyan-700">Open orders <ArrowUpRight size={15} className="inline" /></Link></div><div className="divide-y divide-slate-100">{data.orders.filter((order) => order.status !== "COMPLETED" && order.status !== "CANCELLED").slice(0, 6).map((order) => <LiveOrder key={order._id} order={order} />)}{!data.orders.filter((order) => order.status !== "COMPLETED" && order.status !== "CANCELLED").length && <p className="py-10 text-center text-sm font-semibold text-slate-500">No active orders right now.</p>}</div></section>
        <section className="admin-panel"><div className="panel-heading"><div><p className="admin-kicker">Kitchen load</p><h3 className="panel-title">Queue summary</h3></div><Link to="/admin/queue" className="text-sm font-bold text-cyan-700">Open queue <ArrowUpRight size={15} className="inline" /></Link></div><div className="queue-summary"><div className="queue-count">{data.queue}</div><p className="font-bold text-slate-900">orders in active queue</p><p className="mt-1 text-sm text-slate-500">Prioritize ready pickups and confirmed orders first.</p></div><div className="mt-5 grid grid-cols-2 gap-3"><MiniMetric label="Preparing" value={data.preparing} /><MiniMetric label="Ready" value={data.ready} /></div></section>
      </div>
    </>}</AdminPageState>
  </div>;
}

function LiveOrder({ order }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="font-bold text-slate-900">#{order._id.slice(-6)} <span className="ml-2 text-xs font-semibold text-slate-400">{order.user?.name || order.user?.email || "Customer"}</span></p><p className="mt-1 truncate text-sm text-slate-500">{(order.items || []).map((item) => `${item.name} x${item.quantity}`).join(", ")}</p></div><div className="flex items-center gap-3"><span className="status-badge status-neutral">{order.paymentStatus}</span><span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status.replace("_", " ")}</span></div></div>;
}

function MiniMetric({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>; }
