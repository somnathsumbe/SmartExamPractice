type ToastProps = {
  message: string;
  tone?: "danger" | "success" | "info";
};

export default function Toast({ message, tone = "danger" }: ToastProps) {
  const icon = tone === "success" ? "bi-check-circle" : tone === "info" ? "bi-info-circle" : "bi-exclamation-triangle";
  return (
    <div className={`alert alert-${tone} d-flex align-items-start gap-2 mb-0`} role="alert">
      <i className={`bi ${icon} mt-1`} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}