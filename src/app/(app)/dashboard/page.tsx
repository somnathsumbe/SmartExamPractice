import Link from "next/link";
import EmptyState from "@/components/common/EmptyState";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const displayName = user?.profile.displayName || user?.userName || "there";

  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <p className="eyebrow">YOUR LEARNING SPACE</p>
          <h1>Good to see you, {displayName.split(" ")[0]}.</h1>
          <p>Your next step starts with a little practice.</p>
          <Link className="btn btn-primary app-primary-button" href="/subjects">Explore subjects <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
        </div>
        <div className="welcome-art" aria-hidden="true"><span className="art-sun" /><span className="art-book"><i className="bi bi-journal-bookmark-fill" /></span><span className="art-spark spark-one"><i className="bi bi-stars" /></span><span className="art-spark spark-two"><i className="bi bi-star-fill" /></span></div>
      </section>

      <section className="student-strip" aria-label="Student details">
        <div className="student-badge"><span className="student-avatar"><i className="bi bi-person-fill" aria-hidden="true" /></span><div><strong>{user?.profile.displayName || user?.userName}</strong><span>{user?.profile.className || "Class not set"}{user?.profile.division ? ` / Division ${user.profile.division}` : ""}</span></div></div>
        <div className="school-detail"><i className="bi bi-building" aria-hidden="true" /><span>{user?.profile.schoolName || "School not set"}</span></div>
        <Link href="/profile" className="text-link">Edit profile <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link>
      </section>

      <div className="dashboard-section-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Your study tools</h2></div></div>
      <section className="tool-grid" aria-label="Study tools">
        <Link className="tool-card quick-practice" href="/practice-test"><span className="tool-icon"><i className="bi bi-pencil-square" aria-hidden="true" /></span><span className="tool-content"><strong>Quick Practice</strong><span>Build confidence, one question at a time.</span></span><i className="bi bi-arrow-up-right tool-arrow" aria-hidden="true" /></Link>
        <Link className="tool-card subjects-tool" href="/subjects"><span className="tool-icon"><i className="bi bi-journal-richtext" aria-hidden="true" /></span><span className="tool-content"><strong>Subjects</strong><span>Find the topics you are learning.</span></span><i className="bi bi-arrow-up-right tool-arrow" aria-hidden="true" /></Link>
      </section>

      <section className="dashboard-bottom-grid">
        <div className="content-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR JOURNEY</p><h2>Recent activity</h2></div><i className="bi bi-clock-history" aria-hidden="true" /></div><EmptyState icon="bi-journal-text" title="Your activity will appear here" /></div>
        <div className="content-panel"><div className="panel-heading"><div><p className="eyebrow">AT A GLANCE</p><h2>Performance</h2></div><i className="bi bi-bar-chart-line" aria-hidden="true" /></div><EmptyState icon="bi-graph-up-arrow" title="Your progress starts here" /></div>
      </section>

      <section className="smart-practice-panel"><span className="smart-practice-icon"><i className="bi bi-stars" aria-hidden="true" /></span><div><p className="eyebrow">MADE FOR YOUR NEXT STEP</p><h2>Smart Practice</h2><p>Practice tools will be ready here as your learning plan takes shape.</p></div><span className="coming-soon">Coming soon</span></section>
    </div>
  );
}