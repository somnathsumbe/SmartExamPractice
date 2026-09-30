"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AcademicLoading from "@/components/academics/AcademicLoading";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";

type DisplayQuestion = {
  questionId?: string;
  questionType: string;
  marks: number;
  order: number;
  snapshot: { question: string; questionData: { options?: string[] }; marks: number; difficulty: string };
};
type DisplaySection = { sectionName: string; instructions: string; totalMarks: number; questions: DisplayQuestion[] };
type Paper = {
  _id: string;
  paperName: string;
  className: string;
  examType: string;
  duration: number;
  totalMarks: number;
  totalQuestions: number;
  instructions: string;
  sections: DisplaySection[];
  subject: { name: string };
};
type Variant = { variant: string; totalMarks: number; totalQuestions: number; sections: DisplaySection[] };
type AnswerQuestion = { order: number; question: string; answer: string; acceptableAnswers: string[] };
type AnswerKey = { paperName: string; variant: string; sections: Array<{ sectionName: string; questions: AnswerQuestion[] }> };
type ApiData = { error?: string } & Record<string, unknown>;

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

function PaperInstructions({ instructions }: { instructions: string }) {
  const lines = instructions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return <div className="paper-instructions"><h2>Instructions</h2><ol>{lines.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol></div>;
}

function PaperSections({ sections }: { sections: DisplaySection[] }) {
  return <div className="paper-sections">{sections.map((section, sectionIndex) => <section className="paper-section" key={`${section.sectionName}-${sectionIndex}`}>
    <header className="paper-section-header"><div><h2>{section.sectionName}</h2>{section.instructions && <p>{section.instructions}</p>}</div><strong>{section.totalMarks} Marks</strong></header>
    <ol className="paper-questions" start={sections.slice(0, sectionIndex).reduce((sum, previous) => sum + previous.questions.length, 1)}>{section.questions.map((question, questionIndex) => <li className="paper-question" key={`${question.questionId ?? question.order}-${questionIndex}`}>
        <div className="paper-question-copy"><span>{question.snapshot.question}</span>{question.snapshot.questionData.options?.length ? <ol className="paper-options" type="A">{question.snapshot.questionData.options.map((option, index) => <li key={`${index}-${option}`}>{option}</li>)}</ol> : null}</div>
        <strong className="paper-question-marks">[{question.marks}]</strong>
      </li>)}</ol>
  </section>)}</div>;
}

function PrintPaper({ paper, sections, totalMarks, totalQuestions, schoolName, variant }: {
  paper: Paper;
  sections: DisplaySection[];
  totalMarks: number;
  totalQuestions: number;
  schoolName: string;
  variant: string;
}) {
  return <article className="paper-sheet">
    <header className="paper-school-header"><h1>{schoolName || "School Name"}</h1><p>{paper.className} · {paper.subject.name}</p><h2>{paper.examType}{variant !== "MAIN" ? ` · PAPER ${variant}` : ""}</h2><div className="paper-exam-meta"><span>Time: {paper.duration} {paper.duration === 1 ? "Minute" : "Minutes"}</span><span>Total Marks: {totalMarks}</span></div></header>
    <PaperInstructions instructions={paper.instructions} />
    <PaperSections sections={sections} />
    <footer className="paper-sheet-footer"><span>{paper.paperName}</span><span>{totalQuestions} Questions · {totalMarks} Marks</span><span className="paper-page-number" /></footer>
  </article>;
}

export default function QuestionPaperViewPage({ id, view, initialVariant = "MAIN" }: { id: string; view: "preview" | "print" | "answer-key"; initialVariant?: string }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [availableVariants, setAvailableVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(initialVariant);
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      requestJson<{ paper: Paper } & ApiData>(`/api/question-papers/${id}`, { signal: controller.signal }),
      requestJson<{ variants: Variant[] } & ApiData>(`/api/question-papers/${id}/variants`, { signal: controller.signal }),
      requestJson<{ user: { profile?: { schoolName?: string } } } & ApiData>("/api/auth/me", { signal: controller.signal }),
    ]).then(([paperResult, variantResult, userResult]) => {
      setPaper(paperResult.paper);
      setAvailableVariants(variantResult.variants);
      setSchoolName(userResult.user.profile?.schoolName ?? "");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load the paper." });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refreshKey]);

  useEffect(() => {
    if (view !== "answer-key") return;
    const controller = new AbortController();
    const suffix = selectedVariant === "MAIN" ? "" : `?variant=${selectedVariant}`;
    requestJson<{ answerKey: AnswerKey } & ApiData>(`/api/question-papers/${id}/answer-key${suffix}`, { signal: controller.signal })
      .then((result) => setAnswerKey(result.answerKey))
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load the answer key." }); });
    return () => controller.abort();
  }, [id, selectedVariant, view]);

  async function generateVariants() {
    setGenerating(true);
    setNotice(null);
    try {
      const result = await requestJson<{ variants: Variant[] } & ApiData>(`/api/question-papers/${id}/generate-variants`, { method: "POST" });
      setAvailableVariants((current) => [...current.filter((item) => !result.variants.some((created) => created.variant === item.variant)), ...result.variants].sort((left, right) => left.variant.localeCompare(right.variant)));
      setNotice({ tone: "success", message: result.variants.length ? `Generated Paper ${result.variants.map((item) => item.variant).join(", Paper ")}.` : "Papers A, B, and C already exist." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to generate paper variants." });
    } finally {
      setGenerating(false);
    }
  }

  const selectedVariantData = availableVariants.find((item) => item.variant === selectedVariant);
  const sections = selectedVariant === "MAIN" ? paper?.sections ?? [] : selectedVariantData?.sections ?? [];
  const totalMarks = selectedVariant === "MAIN" ? paper?.totalMarks ?? 0 : selectedVariantData?.totalMarks ?? 0;
  const totalQuestions = selectedVariant === "MAIN" ? paper?.totalQuestions ?? 0 : selectedVariantData?.totalQuestions ?? 0;
  const isPrint = view === "print";
  const isAnswerKey = view === "answer-key";
  const title = isPrint ? "A4 Print" : isAnswerKey ? "Answer Key" : "Paper Preview";

  return <div className={`question-page paper-view-page${isPrint ? " paper-print-route" : ""}${isAnswerKey ? " paper-answer-route" : ""}`}>
    <div className="paper-view-topbar"><Link className="question-back-link" href={isAnswerKey || isPrint ? `/admin/question-papers/${id}/preview` : "/admin/question-papers"}><i className="bi bi-arrow-left" aria-hidden="true" /> {isAnswerKey || isPrint ? "Back to Preview" : "Back to Question Papers"}</Link>{paper && <span>{paper.paperName}</span>}</div>
    {!isPrint && <PageHeader eyebrow="QUESTION PAPER" title={title} description={paper ? `${paper.subject.name} · ${paper.className} · ${paper.examType}` : "Loading paper details"} />}
    {notice && <Toast tone={notice.tone} message={notice.message} />}
    {loading ? <AcademicLoading label="Loading question paper" /> : !paper ? <EmptyState icon="bi-file-earmark-x" title="Paper not found">This paper is unavailable or you do not have access to it.</EmptyState> : isAnswerKey ? answerKey ? <>
      <div className="paper-view-controls paper-print-controls"><label className="paper-field"><span>Paper Variant</span><select className="form-select" value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}><option value="MAIN">Main paper</option>{availableVariants.map((item) => <option value={item.variant} key={item.variant}>Paper {item.variant}</option>)}</select></label><button className="btn btn-outline-secondary" type="button" onClick={() => window.print()}><i className="bi bi-printer" aria-hidden="true" /> Print Answer Key</button><Link className="btn btn-primary app-primary-button" href={`/admin/question-papers/${id}/print${selectedVariant === "MAIN" ? "" : `?variant=${selectedVariant}`}`}>Print Question Paper</Link></div>
      <article className="paper-sheet paper-answer-sheet"><header className="paper-school-header"><h1>{schoolName || "School Name"}</h1><p>{paper.className} · {paper.subject.name}</p><h2>{paper.examType} · ANSWER KEY {answerKey.variant !== "Main" ? `· PAPER ${answerKey.variant}` : ""}</h2><div className="paper-exam-meta"><span>{paper.paperName}</span><span>Total Marks: {paper.totalMarks}</span></div></header><div className="paper-sections">{answerKey.sections.map((section, sectionIndex) => <section className="paper-section" key={`${section.sectionName}-${sectionIndex}`}><header className="paper-section-header"><h2>{section.sectionName}</h2></header><ol className="paper-questions" start={answerKey.sections.slice(0, sectionIndex).reduce((sum, previous) => sum + previous.questions.length, 1)}>{section.questions.map((question, index) => <li className="paper-answer-item" key={`${sectionIndex}-${index}`}><strong>{question.question}</strong><p><span>Answer:</span> {question.answer}{question.acceptableAnswers.length > 0 && <small>Also accepted: {question.acceptableAnswers.join("; ")}</small>}</p></li>)}</ol></section>)}</div><footer className="paper-sheet-footer"><span>Answer Key · {paper.paperName}</span><span>{answerKey.variant}</span><span className="paper-page-number" /></footer></article>
    </> : <AcademicLoading label="Loading answer key" /> : <>
      {view === "preview" && <div className="paper-view-controls"><fieldset className="paper-variant-picker"><legend>Paper Variant</legend><label><input type="radio" name="paper-variant" checked={selectedVariant === "MAIN"} onChange={() => setSelectedVariant("MAIN")} /> Main</label>{(["A", "B", "C"] as const).map((variant) => <label key={variant}><input type="radio" name="paper-variant" checked={selectedVariant === variant} disabled={!availableVariants.some((item) => item.variant === variant)} onChange={() => setSelectedVariant(variant)} /> {variant}</label>)}</fieldset><div className="paper-view-actions"><button className="btn btn-outline-success" type="button" onClick={() => void generateVariants()} disabled={generating}>{generating ? "Generating..." : "Generate A/B/C"}</button><Link className="btn btn-primary app-primary-button" href={`/admin/question-papers/${id}/print${selectedVariant === "MAIN" ? "" : `?variant=${selectedVariant}`}`}><i className="bi bi-printer" aria-hidden="true" /> Print A4</Link><Link className="btn btn-outline-secondary" href={`/admin/question-papers/${id}/answer-key${selectedVariant === "MAIN" ? "" : `?variant=${selectedVariant}`}`}>Answer Key</Link></div></div>}
      {view === "print" && <div className="paper-view-controls paper-print-controls"><label className="paper-field"><span>Paper Variant</span><select className="form-select" value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}><option value="MAIN">Main paper</option>{availableVariants.map((item) => <option value={item.variant} key={item.variant}>Paper {item.variant}</option>)}</select></label><button className="btn btn-primary app-primary-button" type="button" onClick={() => window.print()}><i className="bi bi-printer" aria-hidden="true" /> Print A4</button><Link className="btn btn-outline-secondary" href={`/admin/question-papers/${id}/answer-key${selectedVariant === "MAIN" ? "" : `?variant=${selectedVariant}`}`}>Print Answer Key</Link></div>}
      {selectedVariant !== "MAIN" && !selectedVariantData ? <div className="paper-loading">Paper {selectedVariant} has not been generated.</div> : <PrintPaper paper={paper} sections={sections} totalMarks={totalMarks} totalQuestions={totalQuestions} schoolName={schoolName} variant={selectedVariant} />}
    </>}
  </div>;
}