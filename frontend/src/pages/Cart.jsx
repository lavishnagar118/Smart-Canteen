import { ArrowLeft, Minus, Plus, Trash2, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { useCart } from "../context/CartContext";
import { useState } from "react";

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function Cart() {
  const { items, itemCount, removeItem, updateQuantity, clearCart } = useCart();
  if (!items.length) {
    return <PageContainer><div className="mx-auto max-w-xl"><Link to="/menu" className="inline-flex items-center gap-2 text-sm font-black text-teal-700"><ArrowLeft size={17} /> Browse menu</Link><div className="mt-8"><EmptyState title="Your order is waiting to be started" description="Add a few favourites from the menu and we’ll keep them here while you decide." /></div><Link to="/menu" className="button-primary mt-5 w-full sm:w-auto"><Utensils size={17} /> Explore menu</Link></div></PageContainer>;
  }
  const estimatedTotal = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  return (
    <PageContainer>
      <Link to="/menu" className="inline-flex items-center gap-2 text-sm font-black text-teal-700"><ArrowLeft size={17} /> Continue browsing</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">{itemCount} item{itemCount === 1 ? "" : "s"} selected</p><h1 className="section-title mt-2">Your order</h1></div><button type="button" onClick={clearCart} className="text-sm font-bold text-slate-500 hover:text-red-600">Clear all</button></div>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <section className="space-y-3">
          {items.map((item) => {
            const subtotal = Number(item.price || 0) * item.quantity;
            return <CartItem key={item._id} item={item} subtotal={subtotal} onRemove={removeItem} onUpdate={updateQuantity} />;
          })}
        </section>
        <aside className="surface h-fit p-5 lg:sticky lg:top-24"><p className="eyebrow">Order total</p><h2 className="mt-2 text-2xl font-black text-slate-900">Ready when you are</h2><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between text-slate-500"><span>Items</span><span>{itemCount}</span></div><div className="flex justify-between border-t border-slate-100 pt-4 font-black text-slate-900"><span>Estimated total</span><span className="text-xl text-teal-700">{formatCurrency(estimatedTotal)}</span></div></div><p className="mt-3 text-xs leading-5 text-slate-500">Final amount is verified by the canteen server before payment.</p><Link to="/checkout" className="button-primary mt-6 w-full">Review order</Link><Link to="/menu" className="button-secondary mt-3 w-full">Add more items</Link></aside>
      </div>
    </PageContainer>
  );
}

function CartItem({ item, subtotal, onRemove, onUpdate }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <article className="surface flex gap-4 p-4">
    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#e8f1ed]">{item.imageUrl && !imageFailed ? <img src={item.imageUrl} alt={item.name} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-black text-teal-700/30">{item.name?.charAt(0)}</div>}</div>
    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className="break-words font-black text-slate-900">{item.name}</h2><p className="mt-1 text-sm text-slate-500">₹{Number(item.price || 0).toLocaleString("en-IN")} each</p></div><button type="button" onClick={() => onRemove(item._id)} aria-label={`Remove ${item.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button></div><div className="mt-4 flex items-center justify-between gap-3"><div className="flex items-center rounded-xl border border-slate-200"><button type="button" onClick={() => onUpdate(item._id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease ${item.name}`} className="touch-target flex items-center justify-center text-teal-700 disabled:text-slate-300"><Minus size={16} /></button><span className="w-8 text-center text-sm font-black text-slate-900">{item.quantity}</span><button type="button" onClick={() => onUpdate(item._id, item.quantity + 1)} aria-label={`Increase ${item.name}`} className="touch-target flex items-center justify-center text-teal-700"><Plus size={16} /></button></div><span className="font-black text-slate-900">₹{Number(subtotal || 0).toLocaleString("en-IN")}</span></div></div>
  </article>;
}
