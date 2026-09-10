import { CheckCircle2, Clock3, LogOut, Mail, Phone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import OrderStatusTimeline from "../components/OrderStatusTimeline";
import QueueStatusCard from "../components/QueueStatusCard";
import ConnectionStatus from "../components/ConnectionStatus";
import StatusBadge from "../components/StatusBadge";
import { getOrder, getOrders } from "../services/orderService";
import { connectSocket, joinOrderRoom, subscribeConnectionStatus, subscribeSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const formatDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { getOrders({ limit: 50 }).then((response) => setOrders(response.data.data?.orders || [])).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)); }, []);
  if (loading) return <PageContainer><LoadingSpinner label="Loading your orders..." /></PageContainer>;
  if (error) return <PageContainer><ErrorMessage message={error} /></PageContainer>;
  return <PageContainer><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Your orders</p><h1 className="section-title mt-2">Keep track of every bite</h1></div><Link to="/menu" className="button-primary">Order something new</Link></div><div className="mt-8 grid gap-4 lg:grid-cols-2">{!orders.length && <div className="lg:col-span-2"><EmptyState title="Your order history is empty" description="When you place an order, its progress and details will show up here." /></div>}{orders.map((order) => <Link key={order._id} to={`/orders/${order._id}`} className="surface block p-5 transition hover:-translate-y-1 hover:border-teal-200"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order #{order._id.slice(-6)}</p><h2 className="mt-1 font-black text-slate-900">{(order.items || []).map((item) => `${item.name} × ${item.quantity}`).join(", ")}</h2></div><StatusBadge status={order.status} /></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm"><span className="flex items-center gap-1.5 text-slate-500"><Clock3 size={15} /> {formatDate(order.createdAt)}</span><span className="font-black text-teal-700">{formatCurrency(order.totalAmount)}</span></div><div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>Payment: <span className="text-slate-700">{order.paymentStatus}</span></span><span className="text-teal-700">View details →</span></div></Link>)}</div></PageContainer>;
}

export function OrderDetails() {
  const { orderId } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("offline");
  useEffect(() => { getOrder(orderId).then((response) => setOrder(response.data.data?.order)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)); }, [orderId]);
  useEffect(() => {
    if (!token || !orderId) return undefined;
    const socket = connectSocket(token);
    const join = () => joinOrderRoom(orderId);
    socket?.on("connect", join);
    if (socket?.connected) { setConnectionStatus("live"); join(); }
    const update = (payload) => { if (payload.orderId === orderId) setOrder((current) => current ? { ...current, ...payload } : current); };
    const cleanups = [subscribeSocket("ORDER_STATUS_UPDATED", update), subscribeSocket("QUEUE_UPDATED", update), subscribeSocket("WAIT_TIME_UPDATED", update), subscribeConnectionStatus(setConnectionStatus)];
    return () => { socket?.off("connect", join); cleanups.forEach((cleanup) => cleanup()); };
  }, [token, orderId]);
  if (loading) return <PageContainer><LoadingSpinner label="Loading your live order..." /></PageContainer>;
  if (error) return <PageContainer><ErrorMessage message={error} /></PageContainer>;
  if (!order) return <PageContainer><ErrorMessage message="Order details are unavailable." /></PageContainer>;
  const messages = { PENDING_PAYMENT: "Complete payment to confirm your order.", CONFIRMED: "Your order is confirmed.", ACCEPTED: "Your order has been accepted.", PREPARING: "Your food is being prepared.", READY: "Your order is ready for pickup! 🎉", COMPLETED: "Order completed.", CANCELLED: "This order was cancelled." };
  const confirmed = order.status !== "PENDING_PAYMENT" && order.paymentStatus === "PAID";
  return <PageContainer><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Live order tracking</p><h1 className="mt-2 break-all text-3xl font-black tracking-tight text-slate-900">Order #{order._id.slice(-8)}</h1><p className="mt-2 text-sm text-slate-500">Placed {new Date(order.createdAt).toLocaleString("en-IN")}</p></div><ConnectionStatus status={connectionStatus} /></div>{location.state?.paymentSuccess && <div className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-800"><CheckCircle2 size={19} /> Payment successful. Your order is confirmed.</div>}<div className="mt-6 rounded-3xl bg-slate-900 p-5 text-white sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-teal-300">Current status</p><h2 className="mt-2 text-2xl font-black">{messages[order.status] || "We’re updating your order."}</h2></div><StatusBadge status={order.status} /></div><p className="mt-4 text-sm text-slate-300">Payment: <span className="font-bold text-white">{order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "PENDING" ? "Awaiting payment" : order.paymentStatus}</span></p></div>{confirmed && <div className="mt-5"><QueueStatusCard queuePosition={order.queuePosition} ordersAhead={order.queuePosition ? order.queuePosition - 1 : undefined} estimatedWaitTime={order.estimatedWaitTime} status={order.status} /></div>}<div className="mt-5"><OrderStatusTimeline status={order.status} /></div><section className="surface mt-5 p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">Your items</h2><StatusBadge status={order.paymentStatus} /></div><div className="mt-4 divide-y divide-slate-100">{(order.items || []).map((item) => <div key={`${item.menuItem}-${item.quantity}`} className="flex justify-between gap-4 py-3 text-sm"><span className="text-slate-600">{item.name} × {item.quantity}</span><span className="font-black text-slate-900">{formatCurrency(item.subtotal)}</span></div>)}</div><div className="mt-3 flex justify-between border-t border-slate-100 pt-4 font-black text-slate-900"><span>Total</span><span className="text-teal-700">{formatCurrency(order.totalAmount)}</span></div></section>{order.paymentStatus === "PENDING" && <Link to={`/payment/${order._id}`} className="button-primary mt-5 w-full">Complete payment</Link>}</PageContainer>;
}

export function Profile() {
  const { user, logout } = useAuth();
  return <PageContainer><div className="mx-auto max-w-3xl"><p className="eyebrow">Your account</p><h1 className="section-title mt-2">Profile</h1><section className="surface mt-7 overflow-hidden"><div className="bg-slate-900 p-6 text-white sm:p-8"><div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500 text-2xl font-black text-slate-950">{user?.name?.charAt(0)?.toUpperCase() || "U"}</span><div><h2 className="text-2xl font-black">{user?.name || "Customer"}</h2><p className="mt-1 text-sm text-slate-300">Customer account</p></div></div></div><div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8"><div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Mail size={18} className="mt-0.5 text-teal-700" /><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p><p className="mt-1 break-all text-sm font-bold text-slate-800">{user?.email || "Not provided"}</p></div></div><div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Phone size={18} className="mt-0.5 text-teal-700" /><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone</p><p className="mt-1 text-sm font-bold text-slate-800">{user?.phone || "Not provided"}</p></div></div><div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><UserRound size={18} className="mt-0.5 text-teal-700" /><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Role</p><p className="mt-1 text-sm font-bold text-slate-800">{user?.role || "CUSTOMER"}</p></div></div></div><div className="border-t border-slate-100 px-6 py-5 sm:px-8"><Link to="/orders" className="button-secondary">View my orders</Link><button type="button" onClick={logout} className="ml-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50"><LogOut size={16} /> Sign out</button></div></section></div></PageContainer>;
}
