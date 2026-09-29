"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Toast from "@/components/common/Toast";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.get("identifier"), password: form.get("password"), rememberMe: form.has("rememberMe") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in. Please try again.");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && <Toast message={error} />}
      <label className="form-label" htmlFor="identifier">User name or email <span>*</span></label>
      <div className="input-with-icon"><i className="bi bi-person" aria-hidden="true" /><input suppressHydrationWarning className="form-control" id="identifier" name="identifier" autoComplete="username" required maxLength={254} placeholder="e.g. sam.learning" /></div>
      <div className="label-row"><label className="form-label" htmlFor="password">Password <span>*</span></label></div>
      <div className="input-with-icon"><i className="bi bi-lock" aria-hidden="true" /><input suppressHydrationWarning className="form-control" id="password" name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" /></div>
      <label className="remember-option"><input type="checkbox" name="rememberMe" /> <span>Remember me</span></label>
      <button suppressHydrationWarning className="btn btn-primary app-primary-button w-100" type="submit" disabled={loading}>
        {loading ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Signing in...</> : <>Sign in <i className="bi bi-arrow-right" aria-hidden="true" /></>}
      </button>
      <p className="auth-switch">New to Smart Exam? <Link href="/register">Create an account</Link></p>
    </form>
  );
}