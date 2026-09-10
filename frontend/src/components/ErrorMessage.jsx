import { AlertCircle } from "lucide-react";

export default function ErrorMessage({ message = "Something went wrong.", onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <p>{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white transition hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
