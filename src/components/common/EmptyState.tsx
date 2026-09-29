export default function EmptyState({
  icon,
  title,
  children = "No practice data available yet.",
}: {
  icon: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}