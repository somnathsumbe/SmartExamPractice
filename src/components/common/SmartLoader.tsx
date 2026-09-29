export default function SmartLoader({ label = "Loading your learning space" }: { label?: string }) {
  return (
    <div className="smart-loader" role="status" aria-label={label}>
      <span className="loader-mark"><i className="bi bi-book-half" aria-hidden="true" /></span>
      <span className="loader-lines"><span /><span /><span /></span>
      <span className="visually-hidden">{label}</span>
    </div>
  );
}