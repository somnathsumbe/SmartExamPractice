"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { PublicUser } from "@/types/user";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function AppLayout({ user, children }: { user: PublicUser; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeNav = () => setMobileNavOpen(false);

  return (
    <div className="app-frame">
      <Header user={user} onMenuClick={() => setMobileNavOpen(true)} />
      <div className="app-body">
        <Sidebar open={mobileNavOpen} onNavigate={closeNav} />
        <main className="app-main">{children}<Footer /></main>
      </div>
    </div>
  );
}