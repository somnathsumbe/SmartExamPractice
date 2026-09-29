"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AcademicConfirmDialog from "@/components/academics/AcademicConfirmDialog";
import AcademicLoading from "@/components/academics/AcademicLoading";
import { AcademicStatusBadge } from "@/components/academics/AcademicLists";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import type { QuestionChapter, QuestionListItem, QuestionSubject, QuestionVariantSummary, QuestionView } from "@/components/question-bank/types";
import { questionTypeLabels } from "@/types/question";
import { variantTypeLabels } from "@/components/question-bank/QuestionVariantForm";

type ApiData = { error?: string } & Record<string, unknown>;
type Notice = { tone: "danger" | "success"; message: string };
type QuestionDetails = {
  question: QuestionView;
  subject: { _id: string; name: string; className: string };
  chapter: { _id: string; name: string; chapterNumber: number };
  variants: QuestionVariantSummary[];
  variantCount: number;
};

async function requestJson<T extends ApiData>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  let result: T;
  try {
    response = await fetch(url, init);
    result = await response.json() as T;
  } catch {
    throw new Error("Unable to reach the service. Check your connection and try again.");
  }
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function paramsString(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value.trim()) params.set(key, value.trim());
  return params.toString();
}

export function QuestionBankPage({ defaultClassName = "", initialSubjectId = "", initialChapterId = "" }: { defaultClassName?: string; initialSubjectId?: string; initialChapterId?: string }) {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [subjects, setSubjects] = useState<QuestionSubject[]>([]);
  const [chapters, setChapters] = useState<QuestionChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filtersError, setFiltersError] = useState("");
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState(defaultClassName);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [questionType, setQuestionType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("active");
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDeactivation, setPendingDeactivation] = useState<QuestionListItem | undefined>();
  const [deactivating, setDeactivating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const filters = paramsString({ search, className, subjectId, chapterId, questionType, difficulty, status });

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ subjects: QuestionSubject[] } & ApiData>("/api/subjects", { signal: controller.signal })
      .then((result) => { setSubjects(result.subjects); setFiltersError(""); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setFiltersError(error instanceof Error ? error.message : "Unable to load subjects."); })
      .finally(() => { if (!controller.signal.aborted) setFiltersLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const url = subjectId ? `/api/chapters?subjectId=${encodeURIComponent(subjectId)}` : "/api/chapters";
    requestJson<{ chapters: QuestionChapter[] } & ApiData>(url, { signal: controller.signal })
      .then((result) => setChapters(result.chapters))
      .catch(() => { if (!controller.signal.aborted) setFiltersError("Unable to load chapters for the selected subject."); });
    return () => controller.abort();
  }, [subjectId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      requestJson<{ questions: QuestionListItem[] } & ApiData>(`/api/questions${filters ? `?${filters}` : ""}`, { signal: controller.signal })
        .then((result) => { setQuestions(result.questions); setLoadError(""); setNotice((current) => current?.tone === "danger" ? null : current); })
        .catch((error: unknown) => { if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : "Unable to load questions."; setLoadError(message); setNotice({ tone: "danger", message }); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, refreshKey]);

  async function deactivate() {
    if (!pendingDeactivation) return;
    setDeactivating(true);
    try {
      await requestJson<ApiData>(`/api/questions/${pendingDeactivation._id}`, { method: "DELETE" });
      setPendingDeactivation(undefined);
      setNotice({ tone: "success", message: "Question deactivated." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate the question." });
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="question-page">
      <PageHeader eyebrow="QUESTION BANK" title="Question Bank" description="Manage questions for your chapters" />
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      {filtersError && <Toast message={filtersError} />}
      <div className="question-toolbar">
        <div className="question-filter-grid">
          <label className="question-search"><span className="visually-hidden">Search question</span><i className="bi bi-search" aria-hidden="true" /><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Question" /></label>
          <label><span className="visually-hidden">Class</span><input className="form-control" value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Class" /></label>
          <label><span className="visually-hidden">Subject</span><select className="form-select" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setChapterId(""); setChapters([]); }} disabled={filtersLoading}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select></label>
          <label><span className="visually-hidden">Chapter</span><select className="form-select" value={chapterId} onChange={(event) => setChapterId(event.target.value)} disabled={filtersLoading || chapters.length === 0}><option value="">All chapters</option>{chapters.map((chapter) => <option key={chapter._id} value={chapter._id}>Chapter {chapter.chapterNumber} · {chapter.name}</option>)}</select></label>
          <label><span className="visually-hidden">Question type</span><select className="form-select" value={questionType} onChange={(event) => setQuestionType(event.target.value)}><option value="">All types</option>{Object.entries(questionTypeLabels).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select></label>
          <label><span className="visually-hidden">Difficulty</span><select className="form-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <label><span className="visually-hidden">Status</span><select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <Link className="btn btn-primary app-primary-button question-add-button" href="/question-bank/new"><i className="bi bi-plus-lg" aria-hidden="true" /> Add Question</Link>
      </div>
      {loading ? <AcademicLoading label="Loading questions" /> : loadError && questions.length === 0 ? (
        <section className="content-panel question-empty-panel"><EmptyState icon="bi-exclamation-circle" title="Unable to load questions">{loadError}</EmptyState><button className="btn btn-outline-success" type="button" onClick={() => setRefreshKey((value) => value + 1)}>Try Again</button></section>
      ) : questions.length ? (
        <div className="academic-table-wrap question-table-wrap"><table className="table academic-table question-table align-middle">
          <thead><tr><th>Question</th><th>Subject</th><th>Chapter</th><th>Type</th><th>Difficulty</th><th>Marks</th><th>Variants</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{questions.map((question) => <tr key={question._id}>
            <td><Link className="question-row-link" href={`/question-bank/${question._id}`}>{question.questionText}</Link></td>
            <td>{question.subject.name}</td>
            <td><Link className="academic-subject-link" href={`/chapters/${question.chapterId}`}>Chapter {question.chapter.chapterNumber} · {question.chapter.name}</Link></td>
            <td>{questionTypeLabels[question.questionType]}</td><td className="text-capitalize">{question.difficulty}</td><td>{question.marks}</td><td>{question.variantCount}</td>
            <td><AcademicStatusBadge status={question.status} /></td>
            <td><div className="academic-row-actions"><Link className="btn btn-sm btn-outline-success" href={`/question-bank/${question._id}`}>View</Link><Link className="btn btn-sm btn-light" href={`/question-bank/${question._id}/edit`}>Edit</Link>{question.status === "active" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setPendingDeactivation(question)}>Deactivate</button>}</div></td>
          </tr>)}</tbody>
        </table></div>
      ) : (
        <section className="content-panel question-empty-panel"><EmptyState icon="bi-patch-question" title="No questions found">Create your first question for this chapter.</EmptyState><Link className="btn btn-primary app-primary-button" href="/question-bank/new"><i className="bi bi-plus-lg" aria-hidden="true" /> Add Question</Link></section>
      )}
      {pendingDeactivation && <AcademicConfirmDialog title="Deactivate question?" description="This question will be removed from active lists but remains available when Inactive is selected." submitting={deactivating} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setPendingDeactivation(undefined)} onConfirm={() => void deactivate()} />}
    </div>
  );
}

export function QuestionDetailsPage({ id }: { id: string }) {
  const [details, setDetails] = useState<QuestionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDeactivation, setConfirmDeactivation] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<QuestionVariantSummary | null>(null);
  const [deletingVariant, setDeletingVariant] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestJson<QuestionDetails & ApiData>(`/api/questions/${id}`, { signal: controller.signal })
      .then((result) => { setDetails(result); setNotice((current) => current?.tone === "danger" ? null : current); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load this question." }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refreshKey]);

  async function deactivate() {
    setDeactivating(true);
    try {
      await requestJson<ApiData>(`/api/questions/${id}`, { method: "DELETE" });
      setConfirmDeactivation(false);
      setNotice({ tone: "success", message: "Question deactivated." });
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate the question." });
    } finally {
      setDeactivating(false);
    }
  }

  async function deleteVariant() {
    if (!variantToDelete) return;
    setDeletingVariant(true);
    try {
      await requestJson<ApiData>(`/api/question-variants/${variantToDelete._id}`, { method: "DELETE" });
      setVariantToDelete(null);
      setNotice({ tone: "success", message: "Variant deleted and marked inactive." });
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to delete this variant." });
    } finally {
      setDeletingVariant(false);
    }
  }

  return (
    <div className="question-page question-detail-page">
      <Link className="question-back-link" href="/question-bank"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Question Bank</Link>
      {!loading && details && <nav className="academic-breadcrumb question-breadcrumb" aria-label="Breadcrumb"><ol><li><Link href="/question-bank">Question Bank</Link></li><li><Link href={`/subjects/${details.subject._id}`}>{details.subject.name}</Link></li><li><Link href={`/chapters/${details.chapter._id}`}>{details.chapter.name}</Link></li><li aria-current="page">Question</li></ol></nav>}
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      {loading ? <AcademicLoading label="Loading question details" /> : details ? <>
        <PageHeader eyebrow="QUESTION DETAILS" title={details.question.questionText} description={`${details.subject.name} · ${details.chapter.name}`} />
        <div className="question-detail-actions"><Link className="btn btn-outline-secondary" href={`/chapters/${details.chapter._id}`}>View Chapter</Link><Link className="btn btn-outline-success" href={`/question-bank/${id}/variants/new`}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Variant</Link><Link className="btn btn-primary app-primary-button" href={`/question-bank/${id}/edit`}><i className="bi bi-pencil" aria-hidden="true" /> Edit</Link>{details.question.status === "active" && <button className="btn btn-outline-danger" type="button" onClick={() => { setNotice(null); setConfirmDeactivation(true); }}>Deactivate</button>}</div>
        <section className="question-detail-section">
          <div className="question-detail-heading"><p className="eyebrow">CLASSIFICATION</p><h2>Question Information</h2></div>
          <dl className="question-meta-grid">
            <div><dt>Subject</dt><dd><Link href={`/subjects/${details.subject._id}`}>{details.subject.name}</Link></dd></div>
            <div><dt>Chapter</dt><dd><Link href={`/chapters/${details.chapter._id}`}>Chapter {details.chapter.chapterNumber} · {details.chapter.name}</Link></dd></div>
            <div><dt>Type</dt><dd>{questionTypeLabels[details.question.questionType]}</dd></div>
            <div><dt>Difficulty</dt><dd className="text-capitalize">{details.question.difficulty}</dd></div>
            <div><dt>Marks</dt><dd>{details.question.marks}</dd></div>
            <div><dt>Status</dt><dd><AcademicStatusBadge status={details.question.status} /></dd></div>
          </dl>
        </section>
        <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">PROMPT</p><h2>Question</h2></div><p className="question-readable-text">{details.question.questionText}</p></section>
        <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">EXPECTED RESPONSE</p><h2>Expected Answer</h2></div><p className="question-readable-text">{details.question.answer.text}</p>
          {details.question.options?.length ? <div className="question-options-list"><h3>Choices</h3><ol>{details.question.options.map((option) => <li className={option === details.question.correctOption ? "is-correct" : ""} key={option}>{option}{option === details.question.correctOption && <span>Correct option</span>}</li>)}</ol></div> : null}
          {details.question.answer.acceptableAnswers.length > 0 && <div className="question-alternatives"><h3>Acceptable answers</h3><ul>{details.question.answer.acceptableAnswers.map((answer) => <li key={answer}>{answer}</li>)}</ul></div>}
        </section>
        {details.question.explanation && <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">GUIDANCE</p><h2>Explanation</h2></div><p className="question-readable-text">{details.question.explanation}</p></section>}
        {details.question.keywords.length > 0 && <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">CONCEPTS</p><h2>Keywords</h2></div><ul className="question-keywords">{details.question.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}</ul></section>}
        <section className="question-detail-section question-variants-section">
          <div className="question-variants-heading"><div className="question-detail-heading"><p className="eyebrow">PRACTICE FORMATS</p><h2>Question Variants <span className="academic-count">{details.variantCount}</span></h2></div><Link className="btn btn-primary app-primary-button" href={`/question-bank/${id}/variants/new`}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Variant</Link></div>
          {details.variants.length ? <div className="question-variant-list">{details.variants.map((variant) => <article className="question-variant-row" key={variant._id}>
            <div className="question-variant-type"><span className="question-variant-icon"><i className="bi bi-shuffle" aria-hidden="true" /></span><div><strong>{variantTypeLabels[variant.variantType]}</strong><span className="question-variant-meta text-capitalize">{variant.difficulty} · {variant.marks} {variant.marks === 1 ? "mark" : "marks"} · {variant.status}</span></div></div>
            <p>{variant.questionText}</p>
            <div className="academic-row-actions"><Link className="btn btn-sm btn-outline-success" href={`/question-bank/${id}/variants/${variant._id}`}>View</Link><Link className="btn btn-sm btn-light" href={`/question-bank/${id}/variants/${variant._id}/edit`}>Edit</Link><button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setVariantToDelete(variant)}>Delete</button></div>
          </article>)}</div> : <div className="question-variants-empty"><EmptyState icon="bi-shuffle" title="No question variants yet">Create different practice formats for better concept understanding.</EmptyState><Link className="btn btn-primary app-primary-button" href={`/question-bank/${id}/variants/new`}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Variant</Link></div>}
        </section>
      </> : <section className="content-panel question-empty-panel"><EmptyState icon="bi-exclamation-circle" title="Question unavailable">{notice?.message ?? "This question could not be found."}</EmptyState><Link className="btn btn-outline-success" href="/question-bank">Return to Question Bank</Link></section>}
      {confirmDeactivation && <AcademicConfirmDialog title="Deactivate question?" description="This question will be removed from active lists but remains available when Inactive is selected." submitting={deactivating} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setConfirmDeactivation(false)} onConfirm={() => void deactivate()} />}
      {variantToDelete && <AcademicConfirmDialog title="Delete variant?" description="This variant will be soft deleted and marked inactive. The question and other variants are unchanged." submitting={deletingVariant} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setVariantToDelete(null)} onConfirm={() => void deleteVariant()} />}
    </div>
  );
}