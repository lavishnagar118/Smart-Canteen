const labels = {
  live: ["bg-emerald-50 text-emerald-700", "Live"],
  reconnecting: ["bg-amber-50 text-amber-700", "Reconnecting"],
  offline: ["bg-slate-100 text-slate-600", "Offline"],
};

export default function ConnectionStatus({ status }) {
  const [styles, label] = labels[status] || labels.offline;
  return <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}
