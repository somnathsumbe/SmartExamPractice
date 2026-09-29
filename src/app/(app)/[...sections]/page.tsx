import Link from "next/link";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";

const sectionNames: Record<string, string> = {
  subjects: "Subjects",
  chapters: "Chapters",
  questions: "Questions",
  "hard-words": "Hard Words",
  "practice-test": "Practice Test",
  "smart-practice": "Smart Practice",
  mistakes: "Mistakes",
  performance: "Performance",
  settings: "Settings",
};

export default async function FutureSectionPage({ params }: { params: Promise<{ sections: string[] }> }) {
  const { sections } = await params;
  const slug = sections.at(-1) ?? "learning";
  const title = sectionNames[slug] ?? "Learning";
  return (
    <div className="profile-page future-page">
      <PageHeader eyebrow="YOUR LEARNING SPACE" title={title} description="This space is ready for your learning modules." />
      <section className="content-panel future-panel">
        <EmptyState icon="bi-journal-bookmark" title={`${title} will appear here`} />
        <Link href="/dashboard" className="btn btn-outline-success">Back to dashboard</Link>
      </section>
    </div>
  );
}