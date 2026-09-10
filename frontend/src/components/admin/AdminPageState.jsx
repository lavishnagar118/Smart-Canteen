import EmptyState from "../EmptyState";
import ErrorMessage from "../ErrorMessage";
import LoadingSpinner from "../LoadingSpinner";

export default function AdminPageState({ loading, error, empty, onRetry, children }) {
  if (loading) return <LoadingSpinner label="Loading operational data..." />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title="Nothing to show" description="There are no records available right now." />;
  return children;
}
