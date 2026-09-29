"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AcademicFormDialog, { type SubjectChoice } from "@/components/academics/AcademicFormDialog";
import AcademicConfirmDialog from "@/components/academics/AcademicConfirmDialog";
import AcademicLoading from "@/components/academics/AcademicLoading";
import { AcademicStatusBadge } from "@/components/academics/AcademicLists";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import type { ChapterDetails, SubjectRecord } from "@/components/academics/types";

type ApiData = { error?: string } & Record<string, unknown>;
type Notice = { tone: "danger" | "success"; message: string };
type SubjectDetails = { subject: SubjectRecord; chapterCount: number; chapters: ChapterDetails[] };
type ChapterResponse = { chapter: ChapterDetails; subject: SubjectChoice; questionCounts?: { total: number; active: number; inactive: number } };

async function requestJson<T extends ApiData>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  let data: T;
  try {
    response = await fetch(url, init);
    data = await response.json() as T;
  } catch {
    throw new Error("Unable to reach the service. Check your connection and try again.");
  }
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function toSubjectChoice(subject: SubjectRecord): SubjectChoice {
  return { _id: subject._id, name: subject.name, code: subject.code, className: subject.className, status: subject.status };
}

export function SubjectDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<SubjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<"subject" | "chapter" | null>(null);
  const [editingChapter, setEditingChapter] = useState<ChapterDetails | undefined>();
  const [pendingDeactivation, setPendingDeactivation] = useState<ChapterDetails | undefined>();
  const [deactivating, setDeactivating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<SubjectDetails & ApiData>(`/api/subjects/${id}`, { signal: controller.signal })
      .then((result) => { setDetails(result); setNotice((current) => current?.tone === "danger" ? null : current); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load this subject." }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refreshKey]);

  async function save(values: Record<string, string>) {
    if (!details) return;
    setSubmitting(true);
    try {
      if (dialog === "subject") {
        const payload = { ...values, displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined };
        await requestJson<ApiData>(`/api/subjects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setNotice({ tone: "success", message: "Subject updated." });
      } else {
        const payload = { ...values, chapterNumber: values.chapterNumber ? Number(values.chapterNumber) : undefined, displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined };
        const result = await requestJson<{ chapter: ChapterDetails } & ApiData>(editingChapter ? `/api/chapters/${editingChapter._id}` : "/api/chapters", { method: editingChapter ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!editingChapter) {
          router.push(`/chapters/${result.chapter._id}`);
          return;
        }
        setNotice({ tone: "success", message: editingChapter ? "Chapter updated." : "Chapter added." });
      }
      setLoading(true);
      setDialog(null);
      setEditingChapter(undefined);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save changes." });
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivateChapter() {
    if (!pendingDeactivation) return;
    setDeactivating(true);
    try {
      await requestJson<ApiData>(`/api/chapters/${pendingDeactivation._id}`, { method: "DELETE" });
      setPendingDeactivation(undefined);
      setNotice({ tone: "success", message: "Chapter deactivated successfully." });
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate the chapter." });
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="academic-page academic-detail-page">
      <Link className="academic-back-link" href="/subjects"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Subjects</Link>
      {!loading && details && <nav className="academic-breadcrumb" aria-label="Breadcrumb"><ol><li><Link href="/dashboard">Academics</Link></li><li><Link href="/subjects">Subjects</Link></li><li aria-current="page">{details.subject.name}</li></ol></nav>}
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      {loading ? <AcademicLoading label="Loading subject details" /> : details ? <>
        <PageHeader eyebrow="SUBJECT DETAILS" title={details.subject.name} description={details.subject.className} />
        <div className="academic-detail-actions">
          <Link className="btn btn-outline-secondary" href="/chapters"><i className="bi bi-list-ul" aria-hidden="true" /> All Chapters</Link>
          <button className="btn btn-light" type="button" onClick={() => { setNotice(null); setDialog("subject"); }}><i className="bi bi-pencil" aria-hidden="true" /> Edit Subject</button>
          <button className="btn btn-primary app-primary-button" type="button" disabled={details.subject.status !== "active"} title={details.subject.status === "active" ? undefined : "Reactivate this subject before adding chapters."} onClick={() => { setNotice(null); setEditingChapter(undefined); setDialog("chapter"); }}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Chapter</button>
        </div>
        <section className="content-panel academic-info-panel">
          <div className="academic-section-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Subject Information</h2></div><AcademicStatusBadge status={details.subject.status} /></div>
          <dl className="academic-definition-grid">
            <div><dt>Subject name</dt><dd>{details.subject.name}</dd></div>
            <div><dt>Class</dt><dd>{details.subject.className}</dd></div>
            <div><dt>Code</dt><dd>{details.subject.code || "-"}</dd></div>
            <div><dt>Active chapters</dt><dd>{details.chapterCount}</dd></div>
            <div className="academic-definition-wide"><dt>Description</dt><dd>{details.subject.description || "No description provided."}</dd></div>
          </dl>
        </section>
        <section className="academic-section">
          <div className="academic-section-heading"><div><p className="eyebrow">SUBJECT CONTENT</p><h2>Chapters <span className="academic-count">{details.chapters.length}</span></h2></div></div>
          {details.chapters.length ? <div className="academic-table-wrap"><table className="table academic-table align-middle">
            <thead><tr><th>No.</th><th>Chapter</th><th>Questions</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{details.chapters.map((chapter) => <tr key={chapter._id}>
              <td>{chapter.chapterNumber}</td><td><strong>{chapter.name}</strong>{chapter.description && <span className="academic-row-description">{chapter.description}</span>}</td><td>{chapter.questionCounts?.total ?? 0}</td>
              <td><AcademicStatusBadge status={chapter.status} /></td><td><div className="academic-row-actions"><Link className="btn btn-sm btn-outline-success" href={`/chapters/${chapter._id}`}>View</Link><button className="btn btn-sm btn-light" type="button" onClick={() => { setNotice(null); setEditingChapter(chapter); setDialog("chapter"); }}>Edit</button>{chapter.status === "active" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setPendingDeactivation(chapter)}>Deactivate</button>}</div></td>
            </tr>)}</tbody>
          </table></div> : <div className="content-panel academic-empty-panel"><EmptyState icon="bi-journal-text" title="No chapters yet">Start building this subject by adding your first chapter.</EmptyState><button className="btn btn-primary app-primary-button" type="button" disabled={details.subject.status !== "active"} onClick={() => setDialog("chapter")}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Chapter</button></div>}
        </section>
      </> : <section className="content-panel academic-empty-panel"><p>{notice?.message ?? "This subject could not be found."}</p>{notice?.tone === "danger" && <button className="btn btn-outline-success" type="button" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }}>Try again</button>}<Link className="btn btn-outline-success" href="/subjects">Return to Subjects</Link></section>}
      {dialog === "subject" && details && <AcademicFormDialog kind="subject" initial={details.subject} subjects={[toSubjectChoice(details.subject)]} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onClose={() => setDialog(null)} onSave={save} />}
      {dialog === "chapter" && details && <AcademicFormDialog kind="chapter" initial={editingChapter} lockedSubject={toSubjectChoice(details.subject)} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onClose={() => { setDialog(null); setEditingChapter(undefined); }} onSave={save} />}
      {pendingDeactivation && <AcademicConfirmDialog title="Deactivate Chapter?" description="This chapter will no longer appear in active chapter lists. Its future learning history will remain preserved." submitting={deactivating} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setPendingDeactivation(undefined)} onConfirm={() => void deactivateChapter()} />}
    </div>
  );
}

export function ChapterDetailPage({ id }: { id: string }) {
  const [details, setDetails] = useState<ChapterResponse | null>(null);
  const [subjects, setSubjects] = useState<SubjectChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeactivation, setConfirmDeactivation] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      requestJson<ChapterResponse & ApiData>(`/api/chapters/${id}`, { signal: controller.signal }),
      requestJson<{ subjects: SubjectChoice[] } & ApiData>("/api/subjects", { signal: controller.signal }),
    ]).then(([chapter, subjectsResult]) => {
      setDetails(chapter);
      setSubjects(subjectsResult.subjects);
      setNotice((current) => current?.tone === "danger" ? null : current);
    }).catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load this chapter." }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refreshKey]);

  async function save(values: Record<string, string>) {
    setSubmitting(true);
    try {
      const payload = { ...values, chapterNumber: values.chapterNumber ? Number(values.chapterNumber) : undefined, displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined };
      await requestJson<ApiData>(`/api/chapters/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setDialogOpen(false);
      setNotice({ tone: "success", message: "Chapter updated." });
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save the chapter." });
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate() {
    setDeactivating(true);
    try {
      await requestJson<ApiData>(`/api/chapters/${id}`, { method: "DELETE" });
      setConfirmDeactivation(false);
      setNotice({ tone: "success", message: "Chapter deactivated successfully." });
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate the chapter." });
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="academic-page academic-detail-page">
      <Link className="academic-back-link" href="/chapters"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Chapters</Link>
      {!loading && details && <nav className="academic-breadcrumb" aria-label="Breadcrumb"><ol><li><Link href="/dashboard">Academics</Link></li><li><Link href="/subjects">Subjects</Link></li><li><Link href={`/subjects/${details.subject._id}`}>{details.subject.name}</Link></li><li aria-current="page">{details.chapter.name}</li></ol></nav>}
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      {loading ? <AcademicLoading label="Loading chapter details" /> : details ? <>
        <PageHeader eyebrow={`CHAPTER ${details.chapter.chapterNumber}`} title={details.chapter.name} description={`${details.subject.name} · ${details.chapter.className}`} />
        <div className="academic-detail-actions"><Link className="btn btn-outline-secondary" href={`/subjects/${details.subject._id}`}><i className="bi bi-journal-bookmark" aria-hidden="true" /> View Subject</Link><button className="btn btn-primary app-primary-button" type="button" onClick={() => { setNotice(null); setDialogOpen(true); }}><i className="bi bi-pencil" aria-hidden="true" /> Edit Chapter</button>{details.chapter.status === "active" && <button className="btn btn-outline-danger" type="button" onClick={() => setConfirmDeactivation(true)}>Deactivate Chapter</button>}</div>
        <section className="content-panel academic-info-panel">
          <div className="academic-section-heading"><div><p className="eyebrow">OVERVIEW</p><h2>Chapter Information</h2></div></div>
          <dl className="academic-definition-grid">
            <div><dt>Subject</dt><dd><Link className="academic-subject-link" href={`/subjects/${details.subject._id}`}>{details.subject.name}</Link></dd></div>
            <div><dt>Class</dt><dd>{details.chapter.className}</dd></div>
            <div><dt>Chapter number</dt><dd>{details.chapter.chapterNumber}</dd></div>
            <div><dt>Chapter name</dt><dd>{details.chapter.name}</dd></div>
            <div><dt>Status</dt><dd><AcademicStatusBadge status={details.chapter.status} /></dd></div>
            <div className="academic-definition-wide"><dt>Description</dt><dd>{details.chapter.description || "No description provided."}</dd></div>
          </dl>
        </section>
        <section className="academic-future-grid" aria-label="Chapter learning modules">
          <article className="academic-future-card"><div><p className="eyebrow">LEARNING</p><h2>Learning Content</h2><p>Add chapter learning material later.</p></div><span className="academic-coming-soon">Coming Soon</span></article>
          <article className="academic-future-card question-bank-card"><div><p className="eyebrow">QUESTIONS</p><h2>Question Bank</h2>{details.questionCounts?.total ? <p>Total Questions: {details.questionCounts.total}<br />Active: {details.questionCounts.active} · Inactive: {details.questionCounts.inactive}</p> : <p>No questions created for this chapter yet.</p>}</div><div className="question-bank-card-actions"><Link className="btn btn-outline-secondary" href={`/question-bank?subjectId=${details.subject._id}&chapterId=${details.chapter._id}`}>View Questions</Link><Link className="btn btn-primary app-primary-button" href={`/question-bank/new?subjectId=${details.subject._id}&chapterId=${details.chapter._id}`}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Question</Link></div></article>
          <article className="academic-future-card"><div><p className="eyebrow">VOCABULARY</p><h2>Hard Words</h2><p>Important difficult words for this chapter.</p></div><span className="academic-coming-soon">Coming Soon</span></article>
          <article className="academic-future-card"><div><p className="eyebrow">PRACTICE</p><h2>Practice</h2><p>Practice tests for this chapter.</p></div><button className="btn btn-outline-secondary" type="button" disabled title="Coming soon">Practice Chapter</button></article>
          <article className="academic-future-card"><div><p className="eyebrow">PROGRESS</p><h2>Performance</h2><p>Chapter performance will appear here after practice.</p></div><span className="academic-coming-soon">Coming Soon</span></article>
        </section>
      </> : <section className="content-panel academic-empty-panel"><p>{notice?.message ?? "This chapter could not be found."}</p>{notice?.tone === "danger" && <button className="btn btn-outline-success" type="button" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }}>Try again</button>}<Link className="btn btn-outline-success" href="/chapters">Return to Chapters</Link></section>}
      {dialogOpen && details && <AcademicFormDialog kind="chapter" initial={details.chapter} subjects={subjects} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onClose={() => setDialogOpen(false)} onSave={save} />}
      {confirmDeactivation && <AcademicConfirmDialog title="Deactivate Chapter?" description="This chapter will no longer appear in active chapter lists. Its future learning history will remain preserved." submitting={deactivating} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setConfirmDeactivation(false)} onConfirm={() => void deactivate()} />}
    </div>
  );
}