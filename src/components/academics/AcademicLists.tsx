"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AcademicFormDialog, { type SubjectChoice } from "@/components/academics/AcademicFormDialog";
import AcademicConfirmDialog from "@/components/academics/AcademicConfirmDialog";
import AcademicLoading from "@/components/academics/AcademicLoading";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import type { ChapterRecord, SubjectRecord } from "@/components/academics/types";

type ApiData = { error?: string } & Record<string, unknown>;
type Notice = { tone: "danger" | "success"; message: string };

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

function queryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value.trim()) params.set(key, value.trim());
  return params.toString();
}

export function AcademicStatusBadge({ status }: { status: "active" | "inactive" }) {
  return <span className={`academic-status ${status === "active" ? "is-active" : "is-inactive"}`}><span />{status === "active" ? "Active" : "Inactive"}</span>;
}

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState("");
  const [status, setStatus] = useState("active");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<SubjectRecord | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const params = queryString({ search, className, status });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      requestJson<{ subjects: SubjectRecord[] } & ApiData>(`/api/subjects${params ? `?${params}` : ""}`, { signal: controller.signal })
        .then((result) => { setSubjects(result.subjects); setLoadError(""); setNotice((current) => current?.tone === "danger" ? null : current); })
        .catch((error: unknown) => { if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : "Unable to load subjects."; setLoadError(message); setNotice({ tone: "danger", message }); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [params, refreshKey]);

  async function save(values: Record<string, string>) {
    setSubmitting(true);
    try {
      const payload = { ...values, displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined };
      await requestJson<ApiData>(editing ? `/api/subjects/${editing._id}` : "/api/subjects", {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      setDialogOpen(false);
      setEditing(undefined);
      setNotice({ tone: "success", message: editing ? "Subject updated." : "Subject added." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save the subject." });
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(subject: SubjectRecord) {
    if (!window.confirm(`Deactivate ${subject.name}?`)) return;
    try {
      await requestJson<ApiData>(`/api/subjects/${subject._id}`, { method: "DELETE" });
      setNotice({ tone: "success", message: "Subject deactivated." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate the subject." });
    }
  }

  function openAdd() { setNotice(null); setEditing(undefined); setDialogOpen(true); }

  return (
    <div className="academic-page">
      <PageHeader eyebrow="ACADEMICS" title="Subjects" description="Manage subjects for your child's class" />
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      <div className="academic-toolbar">
        <div className="academic-filter-grid">
          <label className="academic-search"><span className="visually-hidden">Search subjects</span><i className="bi bi-search" aria-hidden="true" /><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Subject" /></label>
          <label><span className="visually-hidden">Filter by class</span><input className="form-control" value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Class" /></label>
          <label><span className="visually-hidden">Filter by status</span><select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <button className="btn btn-primary app-primary-button academic-add-button" type="button" onClick={openAdd}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Subject</button>
      </div>
      {loading ? <AcademicLoading label="Loading subjects" /> : loadError && subjects.length === 0 ? (
        <section className="content-panel academic-empty-panel"><EmptyState icon="bi-exclamation-circle" title="Subjects could not be loaded">{loadError}</EmptyState><button className="btn btn-outline-success" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></section>
      ) : subjects.length ? (
        <div className="academic-table-wrap">
          <table className="table academic-table align-middle">
            <thead><tr><th>Subject</th><th>Code</th><th>Class</th><th>Chapters</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{subjects.map((subject) => <tr key={subject._id}>
              <td><strong>{subject.name}</strong>{subject.description && <span className="academic-row-description">{subject.description}</span>}</td>
              <td>{subject.code || "-"}</td><td>{subject.className}</td><td>{subject.chapterCount ?? 0}</td>
              <td><AcademicStatusBadge status={subject.status} /></td>
              <td><div className="academic-row-actions">
                <Link className="btn btn-sm btn-outline-success" href={`/subjects/${subject._id}`}>View Chapters</Link>
                <button className="btn btn-sm btn-light" type="button" onClick={() => { setNotice(null); setEditing(subject); setDialogOpen(true); }}>Edit</button>
                {subject.status === "active" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => void deactivate(subject)}>Deactivate</button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : (
        <section className="content-panel academic-empty-panel"><EmptyState icon="bi-journal-bookmark" title="No subjects found">Add your first subject to get started.</EmptyState><button className="btn btn-primary app-primary-button" type="button" onClick={openAdd}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Subject</button></section>
      )}
      {dialogOpen && <AcademicFormDialog kind="subject" initial={editing} subjects={subjects as SubjectChoice[]} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onClose={() => { setDialogOpen(false); setEditing(undefined); }} onSave={save} />}
    </div>
  );
}

export function ChaptersPage() {
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState("active");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<ChapterRecord | undefined>();
  const [pendingDeactivation, setPendingDeactivation] = useState<ChapterRecord | undefined>();
  const [deactivating, setDeactivating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const params = queryString({ search, className, subjectId, status });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.all([
        requestJson<{ chapters: ChapterRecord[] } & ApiData>(`/api/chapters${params ? `?${params}` : ""}`, { signal: controller.signal }),
        requestJson<{ subjects: SubjectChoice[] } & ApiData>("/api/subjects", { signal: controller.signal }),
      ]).then(([chapterResult, subjectResult]) => {
        setChapters(chapterResult.chapters);
        setSubjects(subjectResult.subjects);
        setLoadError("");
        setNotice((current) => current?.tone === "danger" ? null : current);
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : "Unable to load chapters."; setLoadError(message); setNotice({ tone: "danger", message }); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [params, refreshKey]);

  async function save(values: Record<string, string>) {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        chapterNumber: values.chapterNumber ? Number(values.chapterNumber) : undefined,
        displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
      };
      await requestJson<ApiData>(editing ? `/api/chapters/${editing._id}` : "/api/chapters", {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      setDialogOpen(false);
      setEditing(undefined);
      setNotice({ tone: "success", message: editing ? "Chapter updated." : "Chapter added." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save the chapter." });
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate() {
    if (!pendingDeactivation) return;
    setDeactivating(true);
    try {
      await requestJson<ApiData>(`/api/chapters/${pendingDeactivation._id}`, { method: "DELETE" });
      setPendingDeactivation(undefined);
      setNotice({ tone: "success", message: "Chapter deactivated successfully." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate the chapter." });
    } finally {
      setDeactivating(false);
    }
  }

  function openAdd() {
    if (!subjects.some((subject) => subject.status === "active")) {
      setNotice({ tone: "danger", message: "Add an active subject before creating a chapter." });
      return;
    }
    setNotice(null);
    setEditing(undefined);
    setDialogOpen(true);
  }

  return (
    <div className="academic-page">
      <PageHeader eyebrow="ACADEMICS" title="Chapters" description="Manage chapters across subjects" />
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      <div className="academic-toolbar">
        <div className="academic-filter-grid academic-filter-grid-chapters">
          <label className="academic-search"><span className="visually-hidden">Search chapters</span><i className="bi bi-search" aria-hidden="true" /><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Chapter" /></label>
          <label><span className="visually-hidden">Filter by subject</span><select className="form-select" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select></label>
          <label><span className="visually-hidden">Filter by class</span><input className="form-control" value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Class" /></label>
          <label><span className="visually-hidden">Filter by status</span><select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <button className="btn btn-primary app-primary-button academic-add-button" type="button" onClick={openAdd}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Chapter</button>
      </div>
      {loading ? <AcademicLoading label="Loading chapters" /> : loadError && chapters.length === 0 ? (
        <section className="content-panel academic-empty-panel"><EmptyState icon="bi-exclamation-circle" title="Chapters could not be loaded">{loadError}</EmptyState><button className="btn btn-outline-success" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></section>
      ) : chapters.length ? (
        <div className="academic-table-wrap">
          <table className="table academic-table align-middle">
            <thead><tr><th>Chapter</th><th>Subject</th><th>Class</th><th>Chapter No.</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{chapters.map((chapter) => <tr key={chapter._id}>
              <td><strong>Chapter {chapter.chapterNumber}</strong><span className="academic-row-description">{chapter.name}</span></td>
              <td><Link className="academic-subject-link" href={`/subjects/${chapter.subjectId}`}>{chapter.subject.name}</Link></td><td>{chapter.className}</td><td>{chapter.chapterNumber}</td>
              <td><AcademicStatusBadge status={chapter.status} /></td>
              <td><div className="academic-row-actions"><Link className="btn btn-sm btn-outline-success" href={`/chapters/${chapter._id}`}>View</Link><button className="btn btn-sm btn-light" type="button" onClick={() => { setNotice(null); setEditing(chapter); setDialogOpen(true); }}>Edit</button>{chapter.status === "active" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setPendingDeactivation(chapter)}>Deactivate</button>}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : (
        <section className="content-panel academic-empty-panel"><EmptyState icon="bi-journal-text" title="No chapters found">Try changing your filters or add a new chapter.</EmptyState><button className="btn btn-primary app-primary-button" type="button" onClick={openAdd}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Chapter</button></section>
      )}
      {dialogOpen && <AcademicFormDialog kind="chapter" initial={editing} subjects={subjects} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onClose={() => { setDialogOpen(false); setEditing(undefined); }} onSave={save} />}
      {pendingDeactivation && <AcademicConfirmDialog title="Deactivate Chapter?" description="This chapter will no longer appear in active chapter lists. Its future learning history will remain preserved." submitting={deactivating} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setPendingDeactivation(undefined)} onConfirm={() => void deactivate()} />}
    </div>
  );
}