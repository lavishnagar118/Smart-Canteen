import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import { useCart } from "../context/CartContext";
import { createOrder } from "../services/orderService";

const isValidObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value));

export default function OrderPreview() {
  const { items, itemCount, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const estimate = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  const confirmOrder = async () => {
    if (!items.length) return setError("Your cart is empty. Add an item before continuing.");
    if (items.some((item) => !isValidObjectId(item._id) || !Number.isInteger(item.quantity) || item.quantity < 1)) return setError("One or more cart items are invalid. Please return to the cart and try again.");
    const canteenIds = [...new Set(items.map((item) => item.canteen?._id || item.canteen).filter(Boolean))];
    if (canteenIds.length > 1) return setError("Your cart contains items from different canteens. Please place separate orders.");
    setLoading(true); setError("");
    try {
      const response = await createOrder(items.map((item) => ({ menuItem: item._id, quantity: item.quantity })), canteenIds[0]);
      const order = response.data.data?.order;
      if (!order?._id) throw new Error("We could not create this order. Please try again.");
      clearCart();
      navigate(`/payment/${order._id}`, { state: { order } });
    } catch (requestError) {
      setError(requestError.message || "We could not create your order. Your cart was kept safe.");
    } finally { setLoading(false); }
  };

  if (!items.length) return <PageContainer><div className="mx-auto max-w-xl"><h1 className="section-title">Review your order</h1><div className="mt-7"><EmptyState title="Nothing to review yet" description="Your cart is empty. Add menu items before checking out." /></div><Link to="/menu" className="button-primary mt-5 w-full sm:w-auto">Browse menu</Link></div></PageContainer>;

  return <PageContainer>
    <Link to="/cart" className="inline-flex items-center gap-2 text-sm font-black text-teal-700"><ArrowLeft size={17} /> Back to cart</Link>
    <div className="mt-5"><p className="eyebrow">One last look</p><h1 className="section-title mt-2">Review your order</h1><p className="mt-2 text-sm text-slate-500">Check your items before we send the order for payment.</p></div>
    <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
      <section className="surface p-5 sm:p-6"><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><CheckCircle2 size={20} /></span><div><h2 className="font-black text-slate-900">Order items</h2><p className="text-sm text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"}</p></div></div><div className="divide-y divide-slate-100">{items.map((item) => <div key={item._id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-black text-slate-900">{item.name}</p><p className="mt-1 text-sm text-slate-500">{item.quantity} × ₹{item.price}</p></div><span className="font-black text-slate-900">₹{Number(item.price || 0) * item.quantity}</span></div>)}</div></section>
      <aside className="surface h-fit p-5 sm:p-6 lg:sticky lg:top-24"><p className="eyebrow">Trusted checkout</p><h2 className="mt-2 text-2xl font-black text-slate-900">Ready to confirm?</h2><div className="mt-6 flex justify-between border-t border-slate-100 pt-4 font-black text-slate-900"><span>Estimated total</span><span className="text-xl text-teal-700">₹{estimate.toLocaleString("en-IN")}</span></div><div className="mt-4 flex gap-3 rounded-2xl bg-[#e8f1ed] p-4 text-sm text-slate-600"><ShieldCheck size={20} className="shrink-0 text-teal-700" /><p>Final amount is verified by the canteen server before payment.</p></div>{error && <div className="mt-4"><ErrorMessage message={error} /></div>}<button type="button" onClick={confirmOrder} disabled={loading} className="button-primary mt-5 w-full">{loading ? "Creating order..." : "Confirm order"}</button></aside>
    </div>
  </PageContainer>;
}
