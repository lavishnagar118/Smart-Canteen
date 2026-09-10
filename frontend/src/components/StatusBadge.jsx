const labels = {
  PENDING_PAYMENT: ["Payment pending", "bg-amber-50 text-amber-800"],
  CONFIRMED: ["Confirmed", "bg-teal-50 text-teal-800"],
  ACCEPTED: ["Accepted", "bg-sky-50 text-sky-800"],
  PREPARING: ["Preparing", "bg-indigo-50 text-indigo-800"],
  READY: ["Ready for pickup", "bg-emerald-50 text-emerald-800"],
  COMPLETED: ["Completed", "bg-slate-100 text-slate-700"],
  CANCELLED: ["Cancelled", "bg-red-50 text-red-700"],
  PAID: ["Paid", "bg-emerald-50 text-emerald-800"],
  PENDING: ["Pending", "bg-amber-50 text-amber-800"],
  FAILED: ["Payment failed", "bg-red-50 text-red-700"],
};

export default function StatusBadge({ status }) {
  const [label, style] = labels[status] || [String(status || "Unknown").replaceAll("_", " "), "bg-slate-100 text-slate-600"];
  return <span className={`status-badge ${style}`}>{label}</span>;
}
