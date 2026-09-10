export default function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div role="status" className="flex min-h-32 items-center justify-center gap-3 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" />
      <span>{label}</span>
    </div>
  );
}
