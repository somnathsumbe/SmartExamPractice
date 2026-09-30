"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";

type Subject = { _id: string; name: string; className: string; status: string };
type Chapter = { _id: string; name: string; chapterNumber: number };
type Paper = {
  _id: string;
  paperName: string;
  className: string;
  examType: string;
  duration: number;
  totalMarks: number;
  totalQuestions: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  subject: { _id: string; name: string };
  chapters: Chapter[];
};
type ApiData = { error?: string } & Record<string, unknown>;
type ListResponse = { papers: Paper[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } & ApiData;

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

export default function QuestionPaperListPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [className, setClassName] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<ListResponse["pagination"]>({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ subjects: Subject[] } & ApiData>("/api/subjects", { signal: controller.signal })
      .then((result) => setSubjects(result.subjects));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!subjectId) return () => controller.abort();
    requestJson<{ chapters: Chapter[] } & ApiData>(`/api/chapters?subjectId=${subjectId}`, { signal: controller.signal })
      .then((result) => setChapters(result.chapters))
      .catch(() => undefined);
    return () => controller.abort();
  }, [subjectId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (subjectId) params.set("subjectId", subjectId);
      if (className) params.set("className", className);
      if (chapterId) params.set("chapterId", chapterId);
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      requestJson<ListResponse>(`/api/question-papers?${params}`, { signal: controller.signal })
        .then((result) => { setPapers(result.papers); setPagination(result.pagination); setNotice((current) => current?.tone === "danger" ? null : current); })
        .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load question papers." }); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, subjectId, className, chapterId, status, search, refreshKey]);

  async function act(paper: Paper, action: "duplicate" | "variants" | "delete") {
    if (action === "delete" && !window.confirm(`Archive "${paper.paperName}"?`)) return;
    try {
      if (action === "duplicate") {
        const result = await requestJson<{ paper: { _id: string } } & ApiData>(`/api/question-papers/${paper._id}/duplicate`, { method: "POST" });
        router.push(`/admin/question-papers/create?id=${result.paper._id}`);
        return;
      }
      if (action === "variants") {
        const result = await requestJson<{ variants: { variant: string }[] } & ApiData>(`/api/question-papers/${paper._id}/generate-variants`, { method: "POST" });
        setNotice({ tone: "success", message: result.variants.length ? `Generated Paper ${result.variants.map((item) => item.variant).join(", Paper ")}.` : "Papers A, B, and C already exist." });
        return;
      }
      await requestJson<ApiData>(`/api/question-papers/${paper._id}`, { method: "DELETE" });
      setNotice({ tone: "success", message: "Question paper archived." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to complete this action." });
    }
  }

  function resetPage() { setPage(1); }
  return <div className="question-page paper-admin-page">
    <PageHeader eyebrow="ASSESSMENT DESIGN" title="Question Papers" description="Build print-ready papers from your Question Bank." />
    {notice && <Toast tone={notice.tone} message={notice.message} />}
    <div className="paper-list-toolbar"><div className="paper-list-filters">
      <label><span>Subject</span><select className="form-select" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setClassName(""); setChapterId(""); resetPage(); }}><option value="">All subjects</option>{subjects.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
      <label><span>Class</span><select className="form-select" value={className} onChange={(event) => { setClassName(event.target.value); resetPage(); }}><option value="">All classes</option>{[...new Set(subjects.filter((item) => !subjectId || item._id === subjectId).map((item) => item.className))].map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
      <label><span>Chapter</span><select className="form-select" value={chapterId} disabled={!subjectId} onChange={(event) => { setChapterId(event.target.value); resetPage(); }}><option value="">All chapters</option>{chapters.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
      <label><span>Status</span><select className="form-select" value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
      <label className="paper-search"><span>Search</span><input className="form-control" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search paper name" /></label>
    </div><Link className="btn btn-primary app-primary-button paper-create-button" href="/admin/question-papers/create"><i className="bi bi-plus-lg" aria-hidden="true" /> Create Paper</Link></div>
    <section className="content-panel paper-list-panel">
      {loading ? <div className="paper-loading">Loading question papers...</div> : papers.length ? <div className="academic-table-wrap"><table className="table academic-table align-middle paper-list-table"><thead><tr><th>Paper Name</th><th>Subject</th><th>Class</th><th>Chapters</th><th>Questions</th><th>Marks</th><th>Duration</th><th>Paper Type</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{papers.map((paper) => <tr key={paper._id}>
        <td><strong>{paper.paperName}</strong></td><td>{paper.subject.name}</td><td>{paper.className}</td><td>{paper.chapters.map((chapter) => chapter.name).join(", ")}</td><td>{paper.totalQuestions}</td><td>{paper.totalMarks}</td><td>{paper.duration} min</td><td>{paper.examType}</td><td><span className={`paper-status-badge paper-status-${paper.status.toLowerCase()}`}>{paper.status}</span></td><td>{new Date(paper.createdAt).toLocaleDateString()}</td>
        <td><div className="paper-row-actions"><Link className="btn btn-sm btn-outline-secondary" href={`/admin/question-papers/${paper._id}/preview`}>View</Link><Link className="btn btn-sm btn-light" href={`/admin/question-papers/create?id=${paper._id}`}>Edit</Link><button className="btn btn-sm btn-light" type="button" onClick={() => void act(paper, "duplicate")}>Duplicate</button><button className="btn btn-sm btn-outline-success" type="button" onClick={() => void act(paper, "variants")}>Generate A/B/C</button><Link className="btn btn-sm btn-light" href={`/admin/question-papers/${paper._id}/print`}>Print</Link>{paper.status !== "ARCHIVED" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => void act(paper, "delete")}>Delete</button>}</div></td>
      </tr>)}</tbody></table></div> : <EmptyState icon="bi-file-earmark-text" title="No question papers found">Create a paper from questions already in your Question Bank.</EmptyState>}
      {pagination.totalPages > 1 && <div className="paper-pagination"><span>{pagination.total} papers · Page {pagination.page} of {pagination.totalPages}</span><div><button className="btn btn-outline-secondary btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="btn btn-outline-secondary btn-sm" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
    </section>
  </div>;
}