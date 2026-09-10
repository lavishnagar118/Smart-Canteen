import { Inbox } from "lucide-react";

export default function EmptyState({ title, description }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Inbox size={21} />
      </span>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
