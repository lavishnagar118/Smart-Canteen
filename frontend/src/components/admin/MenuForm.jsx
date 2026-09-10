import { useEffect, useState } from "react";

const initial = { name: "", description: "", price: "", category: "", imageUrl: "", preparationTime: "" };

export default function MenuForm({ item, canteens = [], onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => setForm(item ? { ...initial, ...item, canteen: item.canteen?._id || item.canteen || "" } : { ...initial, canteen: "" }), [item]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.price) <= 0 || !form.category.trim() || Number(form.preparationTime) < 0) {
      setError("Name, category, positive price, and non-negative preparation time are required.");
      return;
    }
    setError("");
    if (!form.canteen) {
      setError("Select a canteen.");
      return;
    }
    await onSubmit({
      canteen: form.canteen,
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category: form.category.trim(),
      imageUrl: form.imageUrl.trim(),
      preparationTime: Number(form.preparationTime),
    });
  };
  return <form onSubmit={submit} className="space-y-6">
    <div><p className="admin-kicker">Basic information</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-800">Name<input value={form.name} onChange={(e) => update("name", e.target.value)} className="field" placeholder="e.g. Paneer Thali" /></label><label className="block text-sm font-bold text-slate-800">Category<input value={form.category} onChange={(e) => update("category", e.target.value)} className="field" placeholder="Main course" /></label></div><label className="mt-4 block text-sm font-bold text-slate-800">Description<textarea rows="3" value={form.description} onChange={(e) => update("description", e.target.value)} className="field" placeholder="Short description for customers" /></label></div>
    <div><p className="admin-kicker">Pricing and preparation</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-800">Price (INR)<input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} className="field" /></label><label className="block text-sm font-bold text-slate-800">Preparation time (minutes)<input type="number" min="0" step="1" value={form.preparationTime} onChange={(e) => update("preparationTime", e.target.value)} className="field" /></label></div></div>
    <div><p className="admin-kicker">Food image</p><label className="mt-3 block text-sm font-bold text-slate-800">Image URL<input type="url" value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} className="field" placeholder="https://..." /></label>{form.imageUrl && <img src={form.imageUrl} alt="Menu item preview" className="mt-3 h-32 w-full rounded-xl object-cover sm:w-64" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</div>
    <div><p className="admin-kicker">Canteen and availability</p><label className="mt-3 block text-sm font-bold text-slate-800">Canteen<select value={form.canteen} onChange={(e) => update("canteen", e.target.value)} className="field"><option value="">Select a canteen</option>{canteens.filter((canteen) => canteen.isActive || canteen.id === form.canteen || canteen._id === form.canteen).map((canteen) => <option key={canteen.id || canteen._id} value={canteen.id || canteen._id}>{canteen.name}</option>)}</select></label></div>
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={submitting} className="button-primary">{submitting ? "Saving..." : "Save Menu Item"}</button>{onCancel && <button type="button" onClick={onCancel} className="button-secondary">Cancel</button>}</div>
  </form>;
}
