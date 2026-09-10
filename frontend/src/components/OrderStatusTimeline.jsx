const steps = [
  { key: "PLACED", label: "Order placed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY", label: "Ready" },
  { key: "COMPLETED", label: "Completed" },
];
const statusRank = { PENDING_PAYMENT: 0, CONFIRMED: 1, ACCEPTED: 2, PREPARING: 3, READY: 4, COMPLETED: 5, CANCELLED: -1 };

export default function OrderStatusTimeline({ status }) {
  const rank = statusRank[status] ?? 0;
  if (status === "CANCELLED") return <div className="surface p-5"><h2 className="font-black text-slate-900">Order progress</h2><p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">This order was cancelled.</p></div>;
  return <section className="surface p-5 sm:p-6"><h2 className="font-black text-slate-900">Order progress</h2><div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">{steps.map((step, index) => { const complete = step.key === "PLACED" ? rank >= 0 : rank >= index; const current = step.key === status || (status === "PENDING_PAYMENT" && step.key === "PLACED"); return <div key={step.key} className="relative text-center"><span aria-hidden="true" className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${complete ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-400"} ${current ? "ring-4 ring-teal-100" : ""}`}>{complete ? "✓" : index + 1}</span><span className={`mt-2 block text-[11px] font-bold leading-4 ${current ? "text-teal-800" : complete ? "text-slate-700" : "text-slate-400"}`}>{step.label}</span>{index < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-4 hidden h-px sm:block ${rank > index ? "bg-teal-700" : "bg-slate-200"}`} />}</div>; })}</div></section>;
}
