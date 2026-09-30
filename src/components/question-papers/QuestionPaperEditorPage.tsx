"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AcademicLoading from "@/components/academics/AcademicLoading";
import { AcademicStatusBadge } from "@/components/academics/AcademicLists";
import EmptyState from "@/components/common/EmptyState";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import { questionTypeLabels, type QuestionDifficulty, type QuestionType } from "@/types/question";
import type { PaperQuestionRule } from "@/types/question-paper";
import type { PaperVariantSettings } from "@/types/question-paper";

type Subject = { _id: string; name: string; className: string; status: "active" | "inactive" };
type Chapter = { _id: string; name: string; chapterNumber: number; status: "active" | "inactive" };
type BankQuestion = { _id: string; chapterId: string; questionText: string; questionType: QuestionType; difficulty: QuestionDifficulty; marks: number; status: string; chapter: { name: string } };
type RuleDraft = { id: string; questionType: QuestionType; count: number; marks: number; difficultyCounts?: Partial<Record<QuestionDifficulty, number>>; difficultyTargets?: Partial<Record<QuestionDifficulty, number>> };
type SectionDraft = { id: string; sectionName: string; instructions: string; rules: RuleDraft[]; selectedQuestionIds: string[] };
type ExistingPaper = {
  _id: string;
  paperName: string;
  subjectId: string;
  className: string;
  chapterIds: string[];
  examType: string;
  duration: number;
  instructions: string;
  generationMode: "MANUAL" | "RANDOM";
  variantSettings?: PaperVariantSettings;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sections: Array<{ sectionName: string; instructions: string; questionTypes: PaperQuestionRule[]; questions: Array<{ questionId: string }> }>;
};
type ApiData = { error?: string; details?: { message?: string; available?: number; required?: number; difficulty?: QuestionDifficulty } } & Record<string, unknown>;

async function requestJson<T extends ApiData>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  let data: T;
  try {
    response = await fetch(url, init);
    data = await response.json() as T;
  } catch {
    throw new Error("Unable to reach the service. Check your connection and try again.");
  }
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.") as Error & { details?: ApiData["details"] };
    error.details = data.details;
    throw error;
  }
  return data;
}

function newRule(): RuleDraft {
  return { id: crypto.randomUUID(), questionType: "mcq", count: 1, marks: 1 };
}

function newSection(index: number): SectionDraft {
  return { id: crypto.randomUUID(), sectionName: `Section ${String.fromCharCode(65 + index)}`, instructions: "", rules: [newRule()], selectedQuestionIds: [] };
}

const firstSectionId = "paper-section-initial";

function difficultyCounts(count: number, percentages: Record<QuestionDifficulty, number>) {
  const values = (["easy", "medium", "hard"] as QuestionDifficulty[]).map((difficulty) => count * percentages[difficulty] / 100);
  const counts = values.map(Math.floor);
  let remaining = count - counts.reduce((sum, value) => sum + value, 0);
  values.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((left, right) => right.remainder - left.remainder).forEach((item) => {
    if (remaining > 0) { counts[item.index] += 1; remaining -= 1; }
  });
  return { easy: counts[0], medium: counts[1], hard: counts[2] };
}

export default function QuestionPaperEditorPage({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [className, setClassName] = useState("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [paperName, setPaperName] = useState("");
  const [examType, setExamType] = useState("Practice Test");
  const [duration, setDuration] = useState(60);
  const [instructions, setInstructions] = useState("Answer all questions.\nWrite neatly.\nRead each question carefully.");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [mode, setMode] = useState<"MANUAL" | "RANDOM">("MANUAL");
  const [variantSettings, setVariantSettings] = useState<PaperVariantSettings>({ shuffleQuestions: true, shuffleOptions: true, preventSameQuestionAtSamePosition: true });
  const [sections, setSections] = useState<SectionDraft[]>([{ id: firstSectionId, sectionName: "Section A", instructions: "", rules: [{ id: "paper-rule-initial", questionType: "mcq", count: 1, marks: 1 }], selectedQuestionIds: [] }]);
  const [activeSection, setActiveSection] = useState(firstSectionId);
  const [useDifficulty, setUseDifficulty] = useState(false);
  const [distributionDirty, setDistributionDirty] = useState(false);
  const [percentages, setPercentages] = useState<Record<QuestionDifficulty, number>>({ easy: 40, medium: 40, hard: 20 });
  const [questionTypeFilter, setQuestionTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [marksFilter, setMarksFilter] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; message: string } | null>(null);
  const [shortage, setShortage] = useState<{ message: string; available: number; required: number; difficulty?: QuestionDifficulty } | null>(null);
  const [createdPaperId, setCreatedPaperId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ subjects: Subject[] } & ApiData>("/api/subjects", { signal: controller.signal })
      .then((result) => setSubjects(result.subjects.filter((subject) => subject.status === "active")))
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load subjects." }); })
      .finally(() => { if (!controller.signal.aborted && !initialId) setLoading(false); });
    return () => controller.abort();
  }, [initialId]);

  useEffect(() => {
    const controller = new AbortController();
    if (!subjectId || !className) return () => controller.abort();
    requestJson<{ chapters: Chapter[] } & ApiData>(`/api/chapters?subjectId=${subjectId}&className=${encodeURIComponent(className)}`, { signal: controller.signal })
      .then((result) => {
        setChapters(result.chapters.filter((chapter) => chapter.status === "active"));
        setChapterIds((current) => current.filter((id) => result.chapters.some((chapter) => chapter._id === id && chapter.status === "active")));
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load chapters." }); });
    return () => controller.abort();
  }, [subjectId, className]);

  useEffect(() => {
    const controller = new AbortController();
    if (!subjectId || !chapterIds.length || mode !== "MANUAL") return () => controller.abort();
    Promise.all(chapterIds.map((chapterId) => requestJson<{ questions: BankQuestion[] } & ApiData>(`/api/questions?subjectId=${subjectId}&chapterId=${chapterId}&status=active`, { signal: controller.signal })))
      .then((results) => setQuestions(results.flatMap((result) => result.questions)))
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load Question Bank questions." }); });
    return () => controller.abort();
  }, [subjectId, chapterIds, mode]);

  useEffect(() => {
    if (!initialId) return;
    const controller = new AbortController();
    requestJson<{ paper: ExistingPaper } & ApiData>(`/api/question-papers/${initialId}`, { signal: controller.signal })
      .then(({ paper }) => {
        setPaperName(paper.paperName);
        setSubjectId(paper.subjectId);
        setClassName(paper.className);
        setChapterIds(paper.chapterIds);
        setExamType(paper.examType);
        setDuration(paper.duration);
        setInstructions(paper.instructions);
        setStatus(paper.status);
        setMode(paper.generationMode);
        setVariantSettings(paper.variantSettings ?? { shuffleQuestions: true, shuffleOptions: true, preventSameQuestionAtSamePosition: true });
        const loadedRules = paper.sections.flatMap((section) => section.questionTypes);
        const loadedDifficultyCounts = loadedRules.reduce((counts, rule) => {
          if (rule.difficultyTargets) for (const difficulty of ["easy", "medium", "hard"] as const) counts[difficulty] += rule.difficultyTargets[difficulty] ?? 0;
          return counts;
        }, { easy: 0, medium: 0, hard: 0 });
        const hasDifficulty = loadedDifficultyCounts.easy + loadedDifficultyCounts.medium + loadedDifficultyCounts.hard > 0;
        const loadedDifficultyTotal = loadedDifficultyCounts.easy + loadedDifficultyCounts.medium + loadedDifficultyCounts.hard;
        if (hasDifficulty && loadedDifficultyTotal) {
          setUseDifficulty(true);
          const easy = Math.round(loadedDifficultyCounts.easy * 100 / loadedDifficultyTotal);
          const medium = Math.round(loadedDifficultyCounts.medium * 100 / loadedDifficultyTotal);
          setPercentages({ easy, medium, hard: 100 - easy - medium });
        }
        const loadedSections = paper.sections.map((section) => ({
          id: crypto.randomUUID(), sectionName: section.sectionName, instructions: section.instructions,
          rules: section.questionTypes.map((rule) => ({ id: crypto.randomUUID(), questionType: rule.questionType, count: rule.count, marks: rule.marks, difficultyCounts: rule.difficultyCounts, difficultyTargets: rule.difficultyTargets })),
          selectedQuestionIds: section.questions.map((question) => question.questionId),
        }));
        setSections(loadedSections);
        setActiveSection(loadedSections[0]?.id ?? "");
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load this question paper." }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialId]);

  const subject = subjects.find((item) => item._id === subjectId);
  const selectedIds = sections.flatMap((section) => section.selectedQuestionIds);
  const questionMap = new Map(questions.map((question) => [question._id, question]));
  const selectedQuestions = selectedIds.map((id) => questionMap.get(id)).filter((question): question is BankQuestion => Boolean(question));
  const configuredQuestionCount = sections.reduce((sum, section) => sum + section.rules.reduce((ruleSum, rule) => ruleSum + Math.max(0, rule.count), 0), 0);
  const configuredMarks = sections.reduce((sum, section) => sum + section.rules.reduce((ruleSum, rule) => ruleSum + Math.max(0, rule.count) * Math.max(0, rule.marks), 0), 0);
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  const availableQuestions = questions.filter((question) => chapterIds.includes(question.chapterId)
    && (!questionTypeFilter || question.questionType === questionTypeFilter)
    && (!difficultyFilter || question.difficulty === difficultyFilter)
    && (!chapterFilter || question.chapterId === chapterFilter)
    && (!marksFilter || question.marks === Number(marksFilter))
    && (!questionSearch.trim() || question.questionText.toLocaleLowerCase().includes(questionSearch.trim().toLocaleLowerCase())));

  function updateSection(id: string, update: Partial<SectionDraft>) {
    setSections((current) => current.map((section) => section.id === id ? { ...section, ...update } : section));
  }

  function setChapter(chapterId: string, checked: boolean) {
    setChapterIds((current) => checked ? [...current, chapterId] : current.filter((item) => item !== chapterId));
  }

  function toggleQuestion(questionId: string, checked: boolean) {
    if (!active) return;
    setSections((current) => current.map((section) => {
      if (section.id !== active.id) return section;
      return { ...section, selectedQuestionIds: checked ? [...section.selectedQuestionIds, questionId] : section.selectedQuestionIds.filter((id) => id !== questionId) };
    }));
  }

  function moveSelectedQuestion(index: number, offset: number) {
    if (!active) return;
    const destination = index + offset;
    if (destination < 0 || destination >= active.selectedQuestionIds.length) return;
    const reordered = [...active.selectedQuestionIds];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    updateSection(active.id, { selectedQuestionIds: reordered });
  }

  function makePayload(useAvailableQuestions: boolean) {
    return {
      paperName, subjectId, className: subject?.className ?? className, chapterIds, examType, duration, instructions, status, generationMode: mode, variantSettings,
      useAvailableQuestions,
      sections: sections.map((section) => ({
        sectionName: section.sectionName,
        instructions: section.instructions,
        questionTypes: section.rules.map((rule) => ({
          questionType: rule.questionType, count: rule.count, marks: rule.marks,
          ...(useDifficulty ? { difficultyTargets: !distributionDirty && rule.difficultyTargets && Object.values(rule.difficultyTargets).reduce((sum, value) => sum + (value ?? 0), 0) === rule.count ? rule.difficultyTargets : difficultyCounts(rule.count, percentages) } : {}),
        })),
        ...(mode === "MANUAL" ? { questionIds: section.selectedQuestionIds } : {}),
      })),
      ...(mode === "RANDOM" && useDifficulty ? { difficultyDistribution: percentages } : {}),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>, useAvailableQuestions = false) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setShortage(null);
    try {
      const response = await requestJson<{ paper: { _id: string }; warnings?: unknown[] } & ApiData>(
        initialId ? `/api/question-papers/${initialId}` : "/api/question-papers",
        { method: initialId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(makePayload(useAvailableQuestions)) },
      );
      setCreatedPaperId(response.paper._id);
      if (response.warnings?.length) {
        setNotice({ tone: "success", message: `Paper saved with ${response.warnings.length} availability adjustment${response.warnings.length === 1 ? "" : "s"}. Review its question count and marks.` });
      } else {
        router.push(`/admin/question-papers/${response.paper._id}/preview`);
      }
    } catch (error) {
      const details = error instanceof Error && "details" in error ? (error as Error & { details?: typeof shortage }).details : undefined;
      if (details?.available !== undefined && details.required !== undefined) setShortage({ message: details.message ?? (error instanceof Error ? error.message : "Not enough questions are available."), available: details.available, required: details.required, difficulty: details.difficulty });
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save the question paper." });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedMarks = selectedQuestions.reduce((sum, question) => sum + question.marks, 0);
  const selectedInOtherSection = (questionId: string) => sections.some((section) => section.id !== active?.id && section.selectedQuestionIds.includes(questionId));

  return <div className="question-page paper-editor-page">
    <Link className="question-back-link" href="/admin/question-papers"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Question Papers</Link>
    <PageHeader eyebrow="ASSESSMENT DESIGN" title={initialId ? "Edit Question Paper" : "Create Question Paper"} description="Build sections directly from your Question Bank." />
    {loading ? <AcademicLoading label="Loading question paper form" /> : <>
      {notice && <Toast tone={notice.tone} message={notice.message} />}
      {shortage && <div className="alert alert-warning paper-shortage" role="alert"><strong>{shortage.message}</strong><span>Available: {shortage.available} · Required: {shortage.required}{shortage.difficulty ? ` (${shortage.difficulty})` : ""}</span><p>Adjust the distribution or reduce the required questions, or explicitly continue with the available questions.</p><button className="btn btn-warning" type="button" disabled={submitting} onClick={() => void submit({ preventDefault: () => undefined } as FormEvent<HTMLFormElement>, true)}>Generate using available questions</button></div>}
      {createdPaperId && <div className="paper-saved-link"><Link className="btn btn-outline-success" href={`/admin/question-papers/${createdPaperId}/preview`}>Open saved paper preview</Link></div>}
      <form className="paper-editor-form" onSubmit={(event) => void submit(event)}>
        <section className="question-form-section">
          <div className="question-form-section-heading"><div><p className="eyebrow">01 · BASIC INFORMATION</p><h2>Paper details</h2></div></div>
          <div className="paper-basic-grid">
            <label className="paper-field paper-field-wide"><span>Paper Name <b>*</b></span><input className="form-control" value={paperName} onChange={(event) => setPaperName(event.target.value)} maxLength={160} required /></label>
            <label className="paper-field"><span>Class <b>*</b></span><select className="form-select" value={className} onChange={(event) => { setClassName(event.target.value); setChapters([]); setChapterIds([]); if (subjectId && !subjects.some((item) => item._id === subjectId && item.className === event.target.value)) setSubjectId(""); }} required><option value="">Select class</option>{[...new Set(subjects.map((item) => item.className))].map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
            <label className="paper-field"><span>Subject <b>*</b></span><select className="form-select" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setChapters([]); setChapterIds([]); const selected = subjects.find((item) => item._id === event.target.value); if (selected) setClassName(selected.className); }} required><option value="">Select subject</option>{subjects.filter((item) => !className || item.className === className).map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select></label>
            <label className="paper-field"><span>Exam Type <b>*</b></span><select className="form-select" value={examType} onChange={(event) => setExamType(event.target.value)}><option>Practice Test</option><option>Unit Test</option><option>Terminal Exam</option><option>Semester Exam</option><option>Final Exam</option><option>Custom</option></select></label>
            <label className="paper-field"><span>Duration (minutes) <b>*</b></span><input className="form-control" type="number" min={1} max={1440} step={1} value={duration} onChange={(event) => setDuration(Number(event.target.value))} required /></label>
            <label className="paper-field"><span>Status</span><select className="form-select" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
            <div className="paper-field"><span>Calculated total marks</span><output className="paper-total-output">{configuredMarks} marks</output></div>
            <label className="paper-field paper-field-wide"><span>Instructions</span><textarea className="form-control" rows={3} maxLength={4000} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
          </div>
        </section>

        <section className="question-form-section">
          <div className="question-form-section-heading"><div><p className="eyebrow">02 · CHAPTER SELECTION</p><h2>Choose chapters</h2></div><label className="paper-check-label"><input type="checkbox" className="form-check-input" checked={chapters.length > 0 && chapterIds.length === chapters.length} disabled={!chapters.length} onChange={(event) => setChapterIds(event.target.checked ? chapters.map((chapter) => chapter._id) : [])} /> All chapters</label></div>
          {!subjectId ? <p className="paper-inline-note">Select a subject and class to see chapters.</p> : chapters.length ? <div className="paper-chapter-grid">{chapters.map((chapter) => <label className="paper-chapter-option" key={chapter._id}><input className="form-check-input" type="checkbox" checked={chapterIds.includes(chapter._id)} onChange={(event) => setChapter(chapter._id, event.target.checked)} /><span>Chapter {chapter.chapterNumber} · {chapter.name}</span></label>)}</div> : <p className="paper-inline-note">No active chapters are available for this subject.</p>}
          {chapterIds.length > 0 && <p className="paper-selection-count">{chapterIds.length} chapter{chapterIds.length === 1 ? "" : "s"} selected</p>}
        </section>

        <section className="question-form-section">
          <div className="question-form-section-heading"><div><p className="eyebrow">03 · QUESTION COMPOSITION</p><h2>Sections and question types</h2></div><div className="paper-mode-toggle" role="group" aria-label="Question selection mode"><button type="button" className={mode === "MANUAL" ? "is-selected" : ""} onClick={() => setMode("MANUAL")}>Manual selection</button><button type="button" className={mode === "RANDOM" ? "is-selected" : ""} onClick={() => setMode("RANDOM")}>Random selection</button></div></div>
          <div className="paper-section-tabs" role="tablist" aria-label="Paper sections">{sections.map((section, index) => <button type="button" role="tab" aria-selected={activeSection === section.id} className={activeSection === section.id ? "is-active" : ""} key={section.id} onClick={() => setActiveSection(section.id)}>{section.sectionName || `Section ${index + 1}`}</button>)}<button type="button" className="paper-add-section" onClick={() => { const section = newSection(sections.length); setSections((current) => [...current, section]); setActiveSection(section.id); }}>+ Add section</button></div>
          {active && <div className="paper-section-editor">
            <div className="paper-basic-grid"><label className="paper-field"><span>Section Name <b>*</b></span><input className="form-control" value={active.sectionName} onChange={(event) => updateSection(active.id, { sectionName: event.target.value })} maxLength={120} required /></label><label className="paper-field"><span>Section Instructions</span><input className="form-control" value={active.instructions} onChange={(event) => updateSection(active.id, { instructions: event.target.value })} maxLength={1000} /></label></div>
            <div className="paper-rule-heading"><h3>Question Type Distribution</h3><button className="btn btn-sm btn-outline-success" type="button" onClick={() => updateSection(active.id, { rules: [...active.rules, newRule()] })}><i className="bi bi-plus-lg" aria-hidden="true" /> Add type</button></div>
            <div className="paper-rule-list">{active.rules.map((rule) => <div className="paper-rule-row" key={rule.id}>
              <label><span>Question Type</span><select className="form-select" value={rule.questionType} onChange={(event) => updateSection(active.id, { rules: active.rules.map((item) => item.id === rule.id ? { ...item, questionType: event.target.value as QuestionType } : item) })}>{Object.entries(questionTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Questions</span><input className="form-control" type="number" min={1} max={100} value={rule.count} onChange={(event) => updateSection(active.id, { rules: active.rules.map((item) => item.id === rule.id ? { ...item, count: Number(event.target.value) } : item) })} /></label>
              <label><span>Marks each</span><input className="form-control" type="number" min={1} max={5} value={rule.marks} onChange={(event) => updateSection(active.id, { rules: active.rules.map((item) => item.id === rule.id ? { ...item, marks: Number(event.target.value) } : item) })} /></label>
              <output>{rule.count * rule.marks} marks</output><button className="icon-button" type="button" aria-label="Remove question type" title="Remove question type" disabled={active.rules.length === 1} onClick={() => updateSection(active.id, { rules: active.rules.filter((item) => item.id !== rule.id) })}><i className="bi bi-trash3" aria-hidden="true" /></button>
            </div>)}</div>
            {sections.length > 1 && <button className="btn btn-sm btn-outline-danger paper-remove-section" type="button" onClick={() => { const remaining = sections.filter((section) => section.id !== active.id); setSections(remaining); setActiveSection(remaining[0]?.id ?? ""); }}>Remove section</button>}
          </div>}
          <div className="paper-difficulty-panel"><label className="paper-check-label"><input type="checkbox" className="form-check-input" checked={useDifficulty} onChange={(event) => setUseDifficulty(event.target.checked)} /> Set difficulty distribution</label>{useDifficulty && <div className="paper-difficulty-grid">{(["easy", "medium", "hard"] as QuestionDifficulty[]).map((difficulty) => <label className="paper-field" key={difficulty}><span>{difficulty[0].toUpperCase() + difficulty.slice(1)} %</span><input className="form-control" type="number" min={0} max={100} step={1} value={percentages[difficulty]} onChange={(event) => { setDistributionDirty(true); setPercentages((current) => ({ ...current, [difficulty]: Number(event.target.value) })); }} /></label>)}<span className={`paper-percentage-total${Object.values(percentages).reduce((sum, value) => sum + value, 0) === 100 ? " is-valid" : " is-invalid"}`}>{Object.values(percentages).reduce((sum, value) => sum + value, 0)}% / 100%</span></div>}</div>
          <div className="paper-variant-settings"><h3>Paper A/B/C settings</h3><div><label className="paper-check-label"><input type="checkbox" className="form-check-input" checked={variantSettings.shuffleQuestions} onChange={(event) => setVariantSettings((current) => ({ ...current, shuffleQuestions: event.target.checked }))} /> Shuffle question order</label><label className="paper-check-label"><input type="checkbox" className="form-check-input" checked={variantSettings.shuffleOptions} onChange={(event) => setVariantSettings((current) => ({ ...current, shuffleOptions: event.target.checked }))} /> Shuffle MCQ options</label><label className="paper-check-label"><input type="checkbox" className="form-check-input" checked={variantSettings.preventSameQuestionAtSamePosition} onChange={(event) => setVariantSettings((current) => ({ ...current, preventSameQuestionAtSamePosition: event.target.checked }))} /> Prevent the same question at the same position</label></div></div>
          <div className="paper-composition-summary"><span>Configured Questions <strong>{configuredQuestionCount}</strong></span><span>Configured Marks <strong>{configuredMarks}</strong></span><span>Selection <strong>{mode === "MANUAL" ? "Manual" : "Random"}</strong></span></div>
        </section>

        {mode === "MANUAL" && <section className="question-form-section paper-bank-selection">
          <div className="question-form-section-heading"><div><p className="eyebrow">04 · QUESTION BANK</p><h2>Select questions</h2></div><div className="paper-running-summary"><strong>Selected Questions: {selectedIds.length}</strong><strong>Total Marks: {selectedMarks}</strong></div></div>
          {!active ? <EmptyState icon="bi-question-circle" title="Add a section first">Questions will be assigned to the selected section.</EmptyState> : <>
            <div className="paper-question-filters"><label><span>Question type</span><select className="form-select" value={questionTypeFilter} onChange={(event) => setQuestionTypeFilter(event.target.value)}><option value="">All types</option>{Object.entries(questionTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Difficulty</span><select className="form-select" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label><span>Chapter</span><select className="form-select" value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)}><option value="">All selected</option>{chapters.filter((chapter) => chapterIds.includes(chapter._id)).map((chapter) => <option value={chapter._id} key={chapter._id}>{chapter.name}</option>)}</select></label><label><span>Marks</span><select className="form-select" value={marksFilter} onChange={(event) => setMarksFilter(event.target.value)}><option value="">Any</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} mark{value > 1 ? "s" : ""}</option>)}</select></label><label className="paper-question-search"><span>Search</span><input className="form-control" value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search Question Bank" /></label></div>
            {active.selectedQuestionIds.length > 0 && <div className="paper-selected-order"><h3>Selected question order</h3><ol>{active.selectedQuestionIds.map((questionId, index) => {
              const question = questionMap.get(questionId);
              return question ? <li key={questionId}><span>{question.questionText}</span><div><button className="icon-button" type="button" aria-label={`Move question ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => moveSelectedQuestion(index, -1)}><i className="bi bi-arrow-up" aria-hidden="true" /></button><button className="icon-button" type="button" aria-label={`Move question ${index + 1} down`} title="Move down" disabled={index === active.selectedQuestionIds.length - 1} onClick={() => moveSelectedQuestion(index, 1)}><i className="bi bi-arrow-down" aria-hidden="true" /></button><button className="icon-button paper-remove-question" type="button" aria-label={`Remove question ${index + 1}`} title="Remove question" onClick={() => toggleQuestion(questionId, false)}><i className="bi bi-x-lg" aria-hidden="true" /></button></div></li> : null;
            })}</ol></div>}
            <div className="paper-question-list">{availableQuestions.length ? availableQuestions.map((question) => {
              const checked = active.selectedQuestionIds.includes(question._id);
              const assignedElsewhere = selectedInOtherSection(question._id);
              return <label className={`paper-question-choice${checked ? " is-selected" : ""}`} key={question._id}><input type="checkbox" className="form-check-input" checked={checked} disabled={!checked && assignedElsewhere} onChange={(event) => toggleQuestion(question._id, event.target.checked)} /><span className="paper-question-choice-copy"><strong>{question.questionText}</strong><span>{questionTypeLabels[question.questionType]} · {question.difficulty} · {question.marks} {question.marks === 1 ? "Mark" : "Marks"} · {question.chapter.name}</span></span><AcademicStatusBadge status={question.status === "active" ? "active" : "inactive"} /></label>;
            }) : <EmptyState icon="bi-question-circle" title={chapterIds.length ? "No matching questions" : "Select chapters first"}>{chapterIds.length ? "Adjust the filters or add matching questions to the Question Bank." : "Choose at least one chapter to load its questions."}</EmptyState>}</div>
          </>}
        </section>}

        <div className="question-form-actions paper-editor-actions"><span>{selectedIds.length} manually selected · {selectedMarks} marks · {configuredQuestionCount} configured</span><button className="btn btn-primary app-primary-button" type="submit" disabled={submitting || !chapterIds.length || Object.values(percentages).reduce((sum, value) => sum + value, 0) !== 100}>{submitting ? "Saving paper..." : initialId ? "Save paper" : mode === "RANDOM" ? "Generate and save paper" : "Save question paper"}</button></div>
      </form>
    </>}
  </div>;
}