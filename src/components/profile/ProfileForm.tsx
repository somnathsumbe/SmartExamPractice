"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/types/user";
import Toast from "@/components/common/Toast";

export default function ProfileForm({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save your profile.");
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={submit}>
      {error && <Toast message={error} />}{saved && <Toast tone="success" message="Profile saved." />}
      <section className="profile-section"><div className="profile-section-heading"><span className="profile-section-icon"><i className="bi bi-person-vcard" aria-hidden="true" /></span><div><h2>Personal information</h2><p>These details are connected to your account.</p></div></div>
        <div className="profile-fields">
          <div><label className="form-label" htmlFor="userName">User name</label><input className="form-control" id="userName" value={user.userName} readOnly /></div>
          <div><label className="form-label" htmlFor="email">Email</label><input className="form-control" id="email" value={user.email} readOnly /></div>
          <div><label className="form-label" htmlFor="firstName">First name <span>*</span></label><input className="form-control" id="firstName" name="firstName" defaultValue={user.profile.firstName} required maxLength={100} /></div>
          <div><label className="form-label" htmlFor="lastName">Last name</label><input className="form-control" id="lastName" name="lastName" defaultValue={user.profile.lastName} maxLength={100} /></div>
          <div><label className="form-label" htmlFor="mobile">Mobile</label><input className="form-control" id="mobile" name="mobile" defaultValue={user.mobile} maxLength={100} /></div>
        </div>
      </section>
      <section className="profile-section"><div className="profile-section-heading"><span className="profile-section-icon school-icon"><i className="bi bi-mortarboard" aria-hidden="true" /></span><div><h2>School information</h2><p>Used to tailor your learning experience.</p></div></div>
        <div className="profile-fields">
          <div><label className="form-label" htmlFor="schoolName">School name</label><input className="form-control" id="schoolName" name="schoolName" defaultValue={user.profile.schoolName} maxLength={100} /></div>
          <div><label className="form-label" htmlFor="className">Class <span>*</span></label><select className="form-select" id="className" name="className" defaultValue={user.profile.className} required>{user.profile.className && !/^Class (?:[1-9]|1[0-2])$/.test(user.profile.className) && <option>{user.profile.className}</option>}{Array.from({ length: 12 }, (_, index) => <option key={index + 1}>Class {index + 1}</option>)}</select></div>
          <div><label className="form-label" htmlFor="division">Division</label><input className="form-control" id="division" name="division" defaultValue={user.profile.division} maxLength={100} /></div>
          <div><label className="form-label" htmlFor="board">Board</label><select className="form-select" id="board" name="board" defaultValue={user.profile.board}><option value="">Select board</option>{["CBSE", "ICSE", "State Board", "Other"].map((board) => <option key={board}>{board}</option>)}{user.profile.board && !["CBSE", "ICSE", "State Board", "Other"].includes(user.profile.board) && <option>{user.profile.board}</option>}</select></div>
        </div>
      </section>
      <div className="profile-actions"><span><i className="bi bi-shield-check" aria-hidden="true" /> Your account details stay private.</span><button className="btn btn-primary app-primary-button" type="submit" disabled={loading}>{loading ? "Saving..." : "Save changes"}</button></div>
    </form>
  );
}