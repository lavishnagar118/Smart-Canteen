import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function StickyCartBar() {
  const { items, itemCount } = useCart();
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  return (
    <div className="fixed bottom-[5.25rem] left-4 right-4 z-20 md:bottom-6">
      <Link to="/cart" className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl bg-slate-900 px-4 py-3.5 text-white shadow-2xl transition hover:bg-slate-800">
        <span className="flex min-w-0 items-center gap-3"><ShoppingBag size={20} className="shrink-0 text-teal-300" /><span><span className="block text-sm font-black">{itemCount} item{itemCount === 1 ? "" : "s"} in your order</span><span className="block text-xs text-slate-300">Estimated total ₹{total.toLocaleString("en-IN")}</span></span></span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-black text-teal-300">View cart <ArrowRight size={17} /></span>
      </Link>
    </div>
  );
}
