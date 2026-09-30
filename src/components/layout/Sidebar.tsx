"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { PublicUser } from "@/types/user";

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
    children: [{ label: "Questions", href: "/question-bank" }, { label: "Hard Words", href: "/hard-words" }, { label: "Question Papers", href: "/admin/question-papers" }],
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

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ open, role, onNavigate }: { open: boolean; role: PublicUser["role"]; onNavigate: () => void }) {
  const pathname = usePathname();
  const activeGroup = groups.find((group) => group.children?.some((item) => (role === "parent" || item.href !== "/admin/question-papers") && isCurrentRoute(pathname, item.href)))?.label;
  const [expanded, setExpanded] = useState<string | null>(activeGroup ?? null);
  const [collapsedPath, setCollapsedPath] = useState<string | null>(null);

  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onNavigate} />}
      <aside className={`app-sidebar${open ? " is-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-section-label">LEARNING SPACE</div>
        <nav className="sidebar-nav">
          {groups.map((group) => {
            const children = group.children?.filter((item) => role === "parent" || item.href !== "/admin/question-papers");
            if (group.children && !children?.length) return null;
            const childActive = children?.some((item) => isCurrentRoute(pathname, item.href)) ?? false;
            const active = Boolean(group.href && isCurrentRoute(pathname, group.href)) || childActive;
            if (group.children) {
              const isExpanded = activeGroup
                ? collapsedPath === pathname ? expanded === group.label : activeGroup === group.label
                : expanded === group.label;
              return (
                <div className={`nav-group${active ? " is-active-group" : ""}`} key={group.label}>
                  <button className={`sidebar-link${active ? " active" : ""}`} onClick={() => {
                    if (isExpanded) {
                      setExpanded(null);
                      setCollapsedPath(pathname);
                    } else {
                      setExpanded(group.label);
                      setCollapsedPath(activeGroup ? pathname : null);
                    }
                  }} aria-expanded={isExpanded}>
                    <i className={`bi ${group.icon}`} aria-hidden="true" />
                    <span>{group.label}</span>
                    <i className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-right"} nav-chevron`} aria-hidden="true" />
                  </button>
                  <div className={`submenu${isExpanded ? " expanded" : ""}`}>
                    {children?.map((item) => (
                      <Link className={`submenu-link${isCurrentRoute(pathname, item.href) ? " active" : ""}`} href={item.href} key={item.href} onClick={onNavigate}>
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