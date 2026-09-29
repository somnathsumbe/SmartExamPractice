"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  { label: "Dashboard", icon: "bi-speedometer2", href: "/dashboard" },
  {
    label: "Academics",
    icon: "bi-book",
    children: [{ label: "Subjects", href: "/subjects" }, { label: "Chapters", href: "/chapters" }],
  },
  {
    label: "Question Bank",
    icon: "bi-question-circle",
    children: [{ label: "Questions", href: "/questions" }, { label: "Hard Words", href: "/hard-words" }],
  },
  {
    label: "Practice",
    icon: "bi-pencil-square",
    children: [
      { label: "Practice Test", href: "/practice-test" },
      { label: "Smart Practice", href: "/smart-practice" },
      { label: "Mistakes", href: "/mistakes" },
    ],
  },
  { label: "Performance", icon: "bi-graph-up", href: "/performance" },
  { label: "Profile", icon: "bi-person", href: "/profile" },
  { label: "Settings", icon: "bi-gear", href: "/settings" },
];

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const activeGroup = groups.find((group) => group.children?.some((item) => item.href === pathname))?.label;
  const [expanded, setExpanded] = useState<string | null>(activeGroup ?? null);

  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onNavigate} />}
      <aside className={`app-sidebar${open ? " is-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-section-label">LEARNING SPACE</div>
        <nav className="sidebar-nav">
          {groups.map((group) => {
            const childActive = group.children?.some((item) => item.href === pathname) ?? false;
            const active = group.href === pathname || childActive;
            if (group.children) {
              const isExpanded = expanded === group.label;
              return (
                <div className={`nav-group${active ? " is-active-group" : ""}`} key={group.label}>
                  <button className={`sidebar-link${active ? " active" : ""}`} onClick={() => setExpanded(isExpanded ? null : group.label)} aria-expanded={isExpanded}>
                    <i className={`bi ${group.icon}`} aria-hidden="true" />
                    <span>{group.label}</span>
                    <i className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-right"} nav-chevron`} aria-hidden="true" />
                  </button>
                  <div className={`submenu${isExpanded ? " expanded" : ""}`}>
                    {group.children.map((item) => (
                      <Link className={`submenu-link${pathname === item.href ? " active" : ""}`} href={item.href} key={item.href} onClick={onNavigate}>
                        <span className="submenu-dot" />{item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <Link className={`sidebar-link${active ? " active" : ""}`} href={group.href!} key={group.label} onClick={onNavigate}>
                <i className={`bi ${group.icon}`} aria-hidden="true" /><span>{group.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-mark"><i className="bi bi-stars" aria-hidden="true" /></span>
          <p>A little practice goes a long way.</p>
        </div>
      </aside>
    </>
  );
}