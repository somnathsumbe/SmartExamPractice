import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  isRegister = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  isRegister?: boolean;
}) {
  return (
    <main className={`auth-screen${isRegister ? " auth-screen-register" : ""}`}>
      <div className="auth-shell">
        <aside className="auth-aside">
          <Link className="auth-brand" href="/login"><span className="brand-mark"><i className="bi bi-book-half" aria-hidden="true" /></span><span>Smart Exam<span className="brand-second-line">Practice</span></span></Link>
          <div className="auth-aside-copy">
            <span className="auth-aside-kicker"><i className="bi bi-stars" aria-hidden="true" /> A brighter way to learn</span>
            <h2>Make room for<br />your next <em>aha.</em></h2>
            <p>A thoughtful place for practice, progress, and all the small wins along the way.</p>
          </div>
          <div className="auth-illustration" aria-hidden="true">
            <span className="illustration-orbit orbit-one" /><span className="illustration-orbit orbit-two" />
            <span className="illustration-sun" /><span className="illustration-paper paper-back"><i className="bi bi-check-lg" /></span>
            <span className="illustration-paper paper-front"><i className="bi bi-pencil-fill" /></span>
            <span className="illustration-star star-a"><i className="bi bi-stars" /></span><span className="illustration-star star-b"><i className="bi bi-star-fill" /></span>
          </div>
          <p className="auth-aside-foot">A steady step forward, every day.</p>
        </aside>
        <section className="auth-main">
          <Link className="auth-brand auth-brand-mobile" href="/login"><span className="brand-mark"><i className="bi bi-book-half" aria-hidden="true" /></span><span>Smart Exam<span className="brand-second-line">Practice</span></span></Link>
          <div className="auth-form-wrap">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p className="auth-intro">{description}</p>
            {children}
          </div>
          <p className="auth-privacy"><i className="bi bi-shield-lock" aria-hidden="true" /> Your learning space is private and secure.</p>
        </section>
      </div>
    </main>
  );
}