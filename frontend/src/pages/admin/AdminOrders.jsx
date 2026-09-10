import { useCallback, useEffect, useState } from "react";
import { Filter, RefreshCw } from "lucide-react";
import { getOperationalOrders } from "../../services/adminService";
import { updateQueueOrder } from "../../services/queueService";
import { subscribeSocket, joinOrderRoom } from "../../services/socket";
import AdminPageState from "../../components/admin/AdminPageState";

const actionFor = { CONFIRMED: ["accept", "Accept Order"], ACCEPTED: ["start", "Start Preparing"], PREPARING: ["ready", "Mark Ready"], READY: ["complete", "Complete Order"] };
const formatDate = (date) => new Date(date).toLocaleString("en-IN");

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await getOperationalOrders({ limit: 100 }); setOrders(response.data.data?.orders || []); }
    catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const unsubscribers = ["ORDER_STATUS_UPDATED", "QUEUE_UPDATED", "WAIT_TIME_UPDATED"].map((event) => subscribeSocket(event, (payload) => setOrders((current) => current.map((order) => order._id === payload.orderId ? { ...order, ...payload } : order))));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [load]);
  useEffect(() => { orders.forEach((order) => joinOrderRoom(order._id)); }, [orders]);
  const transition = async (orderId, transitionAction) => {
    setAction(`${orderId}:${transitionAction}`);
    try { const response = await updateQueueOrder(orderId, transitionAction); const updated = response.data.data?.order; setOrders((current) => current.map((order) => order._id === orderId ? { ...order, ...updated } : order)); }
    catch (requestError) { setError(requestError.message); } finally { setAction(""); }
  };
  return <div><div className="admin-page-heading"><div><p className="admin-kicker">Operations</p><h2 className="admin-title">Orders</h2><p className="admin-subtitle">Move each paid order through the kitchen state machine.</p></div><button type="button" onClick={load} className="button-secondary"><RefreshCw size={16} /> Refresh</button></div><div className="filter-strip"><Filter size={16} /><span>Showing the latest 100 operational orders</span></div><AdminPageState loading={loading} error={error} empty={!orders.length} onRetry={load}><div className="space-y-3 lg:hidden">{orders.map((order) => <OrderCard key={order._id} order={order} action={action} onAction={transition} />)}</div><div className="admin-table-wrap hidden lg:block"><table className="admin-table"><thead><tr>{["Order", "Customer", "Items", "Amount", "Payment", "Status", "Created", "Action"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td className="font-black">#{order._id.slice(-6)}</td><td>{order.user?.name || order.user?.email || "Customer"}</td><td className="max-w-[260px] truncate">{(order.items || []).map((item) => `${item.name} x${item.quantity}`).join(", ")}</td><td className="font-black">Rs. {order.totalAmount}</td><td><span className="status-badge status-neutral">{order.paymentStatus}</span></td><td><span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status.replace("_", " ")}</span></td><td className="whitespace-nowrap text-slate-500">{formatDate(order.createdAt)}</td><td><ActionButton order={order} action={action} onAction={transition} /></td></tr>)}</tbody></table></div></AdminPageState></div>;
}

function ActionButton({ order, action, onAction }) {
  const config = actionFor[order.status];
  if (!config) return <span className="text-xs font-semibold text-slate-400">No action</span>;
  const [key, label] = config;
  return <button disabled={action === `${order._id}:${key}`} onClick={() => onAction(order._id, key)} className="action-button">{action === `${order._id}:${key}` ? "Updating..." : label}</button>;
}

function OrderCard({ order, action, onAction }) {
  return <div className="admin-panel"><div className="flex justify-between gap-3"><b className="text-slate-950">#{order._id.slice(-6)}</b><span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status.replace("_", " ")}</span></div><p className="mt-3 text-sm text-slate-600">{(order.items || []).map((item) => `${item.name} x${item.quantity}`).join(", ")}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="status-badge status-neutral">{order.paymentStatus}</span><b className="text-slate-950">Rs. {order.totalAmount}</b></div><p className="mt-2 text-xs text-slate-400">{formatDate(order.createdAt)}</p><div className="mt-4"><ActionButton order={order} action={action} onAction={onAction} /></div></div>;
}
