import { ArrowRight, Clock3, MapPin, Search, Sparkles, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import FoodCard from "../components/FoodCard";
import StickyCartBar from "../components/StickyCartBar";
import { getCanteen, getCanteenMenu } from "../services/canteenService";
import { getMenu } from "../services/menuService";
import { getPublicQueueSummary } from "../services/queueService";
import { getPeakHours } from "../services/analyticsService";
import { useCart } from "../context/CartContext";

const formatTime = (time) => time ? new Date(`1970-01-01T${time}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Unavailable";

export default function CanteenHome() {
  const { canteenId } = useParams();
  const { addItem } = useCart();
  const [canteen, setCanteen] = useState(null);
  const [items, setItems] = useState([]);
  const [queue, setQueue] = useState({ queueLength: 0, estimatedWaitTime: 0 });
  const [peak, setPeak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!canteenId) {
        const response = await getMenu({ limit: 8 });
        setCanteen(null);
        setItems(response.data.data?.items || []);
        return;
      }
      const response = await getCanteen(canteenId);
      const current = response.data.data?.canteen;
      setCanteen(current);
      if (!current?.isActive) {
        setItems([]);
        setQueue({ queueLength: 0, estimatedWaitTime: 0 });
        setPeak(null);
        return;
      }
      const [menuResponse, queueResponse, peakResponse] = await Promise.all([
        getCanteenMenu(canteenId, { limit: 100 }),
        getPublicQueueSummary(canteenId),
        getPeakHours({ canteenId }).catch(() => ({ data: { data: null } })),
      ]);
      setItems(menuResponse.data.data?.items || []);
      const summary = queueResponse.data.data || {};
      setQueue({ queueLength: Number(summary.queueLength || 0), estimatedWaitTime: Number(summary.estimatedWaitTime || 0) });
      setPeak(peakResponse.data.data || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [canteenId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageContainer><LoadingSpinner label="Loading today's menu..." /></PageContainer>;
  if (error) return <PageContainer><ErrorMessage message={error} onRetry={load} /></PageContainer>;

  const currentHour = new Date().getHours();
  const currentPeak = peak?.peakHours?.find((row) => Number(row.start?.slice(0, 2)) === currentHour);
  const bestTime = peak?.bestTimeToOrder;
  const isBestTime = bestTime?.start?.slice(0, 2) === String(currentHour).padStart(2, "0");
  const rush = currentPeak ? ["Peak hour", "bg-red-50 text-red-700"] : isBestTime ? ["Low rush", "bg-emerald-50 text-emerald-700"] : ["Moderate rush", "bg-amber-50 text-amber-700"];

  return (
    <PageContainer>
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-900 px-6 py-8 text-white shadow-2xl sm:px-10 sm:py-12">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-700/30 blur-2xl" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-teal-200"><MapPin size={16} /> {canteen?.location || "Campus dining"}</div>
          <p className="mt-8 text-sm font-bold text-slate-300">{canteen?.name || "Today's menu"}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{canteen ? "Good food. Less waiting." : "Your next good meal starts here."}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{canteen?.description || "Browse the available menu, add your favourites, and keep your break moving."}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={canteenId ? `/menu?canteenId=${canteenId}` : "/menu"} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-400">Browse menu <ArrowRight size={17} /></Link>
            <Link to="/orders" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white hover:bg-white/10">View orders</Link>
          </div>
        </div>
      </section>

      {canteen && !canteen.isActive ? (
        <div className="mt-6"><EmptyState title="This canteen is currently unavailable" description="Please check back later or browse another available canteen." /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="surface p-5"><div className="flex items-center gap-2 text-teal-700"><Clock3 size={19} /><span className="text-xs font-black uppercase tracking-wider">Estimated wait</span></div><p className="mt-3 text-3xl font-black text-slate-900">{queue.estimatedWaitTime} <span className="text-base font-bold text-slate-500">min</span></p><p className="mt-1 text-sm text-slate-500">Based on current kitchen activity</p></div>
            <div className="surface p-5"><div className="flex items-center gap-2 text-teal-700"><Users size={19} /><span className="text-xs font-black uppercase tracking-wider">Kitchen status</span></div><p className="mt-3 text-3xl font-black text-slate-900">{queue.queueLength === 0 ? "Ready" : `${queue.queueLength} orders`}</p><p className="mt-1 text-sm text-slate-500">{queue.queueLength === 0 ? "No active orders ahead" : "Orders currently being handled"}</p></div>
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Start with something good</p><h2 className="section-title mt-2">Today's menu</h2></div><Link to={canteenId ? `/menu?canteenId=${canteenId}` : "/menu"} className="inline-flex items-center gap-1 text-sm font-black text-teal-700">See full menu <ArrowRight size={16} /></Link></div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400"><Search size={18} className="text-teal-700" /> Search the full menu <Link to={canteenId ? `/menu?canteenId=${canteenId}` : "/menu"} className="ml-auto font-black text-teal-700">Explore</Link></div>
            {items.length === 0 ? <div className="mt-5"><EmptyState title="Menu coming soon" description="Check back shortly for today's dishes." /></div> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.slice(0, 8).map((item, index) => <FoodCard key={item._id} item={item} onAdd={addItem} featured={index === 0} />)}</div>}
          </section>

          {peak && <section className="mt-10 rounded-3xl bg-[#e8f1ed] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow flex items-center gap-2"><Sparkles size={15} /> Plan your break</p><h2 className="mt-2 text-2xl font-black text-slate-900">Know before you go</h2></div><span className={`status-badge ${rush[1]}`}>{rush[0]}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Peak time</p><p className="mt-2 font-black text-slate-900">{peak.peakHours?.[0] ? `${formatTime(peak.peakHours[0].start)} – ${formatTime(peak.peakHours[0].end)}` : "Unavailable"}</p></div><div className="rounded-2xl bg-white/80 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Best time to order</p><p className="mt-2 font-black text-slate-900">{bestTime ? `${formatTime(bestTime.start)} – ${formatTime(bestTime.end)}` : "Unavailable"}</p></div></div></section>}
        </>
      )}
      <StickyCartBar />
    </PageContainer>
  );
}
