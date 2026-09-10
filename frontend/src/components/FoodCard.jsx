import { Check, Plus } from "lucide-react";
import { useState } from "react";

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function FoodCard({ item, onAdd, featured = false }) {
  const available = item.isAvailable !== false;
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className={`group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(36,48,56,0.1)] ${available ? "border-slate-200/80" : "border-slate-200 opacity-70"}`}>
      <div className="relative aspect-[1.45] overflow-hidden bg-[#e8f1ed]">
        {item.imageUrl && !imageFailed ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-black text-teal-700/30">{item.name?.charAt(0)?.toUpperCase() || "F"}</div>
        )}
        {featured && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-teal-800">Popular</span>}
        {!available && <span className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-black text-white">Sold out</span>}
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-sm font-black leading-5 text-slate-900">{item.name}</h3>
          <span className="shrink-0 text-sm font-black text-teal-700">{formatCurrency(item.price)}</span>
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-4 text-slate-500">{item.description || "Freshly prepared for your break."}</p>
        <button type="button" disabled={!available} onClick={() => onAdd(item)} className="mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          {available ? <><Plus size={15} /> Add to order</> : <><Check size={15} /> Unavailable</>}
        </button>
      </div>
    </article>
  );
}
