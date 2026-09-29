"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicUser } from "@/types/user";

export default function Header({ user, onMenuClick }: { user: PublicUser; onMenuClick: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="app-header">
      <button className="icon-button menu-toggle" onClick={onMenuClick} aria-label="Open navigation"><i className="bi bi-list" /></button>
      <div className="brand-lockup">
        <span className="brand-mark"><i className="bi bi-book-half" aria-hidden="true" /></span>
        <span>Smart Exam<span className="brand-second-line">Practice</span></span>
      </div>
      <div className="header-actions">
        <button className="icon-button notification-button" aria-label="Notifications"><i className="bi bi-bell" /><span className="notification-dot" /></button>
        <div className="user-menu-wrap">
          <button className="user-menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            <span className="user-avatar">{(user.profile.displayName || user.userName).slice(0, 1).toUpperCase()}</span>
            <span className="user-menu-name">{user.profile.displayName || user.userName}</span>
            <i className="bi bi-chevron-down" aria-hidden="true" />
          </button>
          {menuOpen && <div className="user-menu-popover">
            <span className="user-menu-email">{user.email}</span>
            <button onClick={signOut} disabled={signingOut}><i className="bi bi-box-arrow-right" aria-hidden="true" />{signingOut ? "Signing out..." : "Sign out"}</button>
          </div>}
        </div>
        <button className="signout-button" onClick={signOut} disabled={signingOut}><i className="bi bi-box-arrow-right" aria-hidden="true" /><span>Sign out</span></button>
      </div>
    </header>
  );
}