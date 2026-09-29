"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Toast from "@/components/common/Toast";

export default function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create your account.");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form register-form" onSubmit={submit}>
      {error && <Toast message={error} />}
      <div className="form-grid">
        <div className="field-span-two"><label className="form-label" htmlFor="userName">User name <span>*</span></label><input className="form-control" id="userName" name="userName" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.-]+" autoComplete="username" placeholder="Choose a user name" /></div>
        <div><label className="form-label" htmlFor="firstName">First name <span>*</span></label><input className="form-control" id="firstName" name="firstName" required maxLength={80} autoComplete="given-name" /></div>
        <div><label className="form-label" htmlFor="lastName">Last name</label><input className="form-control" id="lastName" name="lastName" maxLength={80} autoComplete="family-name" /></div>
        <div className="field-span-two"><label className="form-label" htmlFor="email">Email <span>*</span></label><input className="form-control" id="email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></div>
        <div className="field-span-two"><label className="form-label" htmlFor="mobile">Mobile</label><input className="form-control" id="mobile" name="mobile" type="tel" maxLength={20} autoComplete="tel" /></div>
        <div><label className="form-label" htmlFor="password">Password <span>*</span></label><input className="form-control" id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></div>
        <div><label className="form-label" htmlFor="confirmPassword">Confirm password <span>*</span></label><input className="form-control" id="confirmPassword" name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></div>
        <div className="field-span-two"><label className="form-label" htmlFor="schoolName">School name</label><input className="form-control" id="schoolName" name="schoolName" maxLength={100} /></div>
        <div><label className="form-label" htmlFor="className">Class <span>*</span></label><select className="form-select" id="className" name="className" required defaultValue=""><option value="" disabled>Select class</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1}>Class {index + 1}</option>)}</select></div>
        <div><label className="form-label" htmlFor="division">Division</label><input className="form-control" id="division" name="division" maxLength={30} /></div>
        <div className="field-span-two"><label className="form-label" htmlFor="board">Board</label><select className="form-select" id="board" name="board" defaultValue=""><option value="">Select board</option><option>CBSE</option><option>ICSE</option><option>State Board</option><option>Other</option></select></div>
      </div>
      <p className="password-hint">Use at least 10 characters, including uppercase, lowercase, and a number.</p>
      <button className="btn btn-primary app-primary-button w-100" type="submit" disabled={loading}>
        {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Creating account...</> : <>Create account <i className="bi bi-arrow-right" aria-hidden="true" /></>}
      </button>
      <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  );
}