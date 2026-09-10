export default function PageContainer({ children, className = "" }) {
  return <main className={`page-shell ${className}`}>{children}</main>;
}
