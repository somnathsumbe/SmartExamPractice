export default function Footer() {
  return (
    <footer className="app-footer">
      <div>
        <strong>Smart Exam Practice</strong>
        <span>Smart learning. Better practice. Better preparation.</span>
      </div>
      <small>{new Date().getFullYear()} Smart Exam Practice</small>
    </footer>
  );
}