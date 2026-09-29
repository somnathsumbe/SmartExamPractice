"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AcademicLoading from "@/components/academics/AcademicLoading";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import type { QuestionChapter, QuestionSubject, QuestionView } from "@/components/question-bank/types";
import { questionTypeLabels, type QuestionDifficulty, type QuestionType } from "@/types/question";

type ApiData = { error?: string } & Record<string, unknown>;
type FormState = {
  subjectId: string;
  chapterId: string;
  questionText: string;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  answerText: string;
  acceptableAnswersText: string;
  explanation: string;
  marks: string;
  keywordsText: string;
  status: "active" | "inactive";
  correctOption: string;
};

const initialForm: FormState = {
  subjectId: "", chapterId: "", questionText: "", questionType: "short_answer", difficulty: "easy",
  answerText: "", acceptableAnswersText: "", explanation: "", marks: "1", keywordsText: "", status: "active", correctOption: "",
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

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export default function QuestionForm({ questionId, defaultSubjectId = "", defaultChapterId = "" }: {
  questionId?: string;
  defaultSubjectId?: string;
  defaultChapterId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(questionId);
  const [form, setForm] = useState<FormState>(() => ({ ...initialForm, subjectId: defaultSubjectId, chapterId: defaultChapterId }));
  const [optionsText, setOptionsText] = useState("");
  const [subjects, setSubjects] = useState<QuestionSubject[]>([]);
  const [chapters, setChapters] = useState<QuestionChapter[]>([]);
  const [loadedChapterSubjectId, setLoadedChapterSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      requestJson<{ subjects: QuestionSubject[] } & ApiData>("/api/subjects", { signal: controller.signal }),
      questionId ? requestJson<{ question: QuestionView } & ApiData>(`/api/questions/${questionId}`, { signal: controller.signal }) : Promise.resolve(null),
    ]).then(([subjectResult, questionResult]) => {
      setSubjects(subjectResult.subjects);
      if (questionResult) {
        const question = questionResult.question;
        setForm({
          subjectId: question.subjectId,
          chapterId: question.chapterId,
          questionText: question.questionText,
          questionType: question.questionType,
          difficulty: question.difficulty,
          answerText: question.answer.text,
          acceptableAnswersText: question.answer.acceptableAnswers.join("\n"),
          explanation: question.explanation,
          marks: String(question.marks),
          keywordsText: question.keywords.join("\n"),
          status: question.status,
          correctOption: question.correctOption ?? "",
        });
        setOptionsText(question.options?.join("\n") ?? "");
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load question data.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [questionId]);

  useEffect(() => {
    if (!form.subjectId) return;
    const controller = new AbortController();
    requestJson<{ chapters: QuestionChapter[] } & ApiData>(`/api/chapters?subjectId=${encodeURIComponent(form.subjectId)}`, { signal: controller.signal })
      .then((result) => {
        setChapters(result.chapters);
        setLoadedChapterSubjectId(form.subjectId);
        if (form.chapterId && !result.chapters.some((chapter) => chapter._id === form.chapterId)) {
          setForm((current) => ({ ...current, chapterId: "" }));
        }
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Unable to load chapters."); setLoadedChapterSubjectId(form.subjectId); } });
    return () => controller.abort();
  }, [form.subjectId, form.chapterId]);

  const selectedSubject = subjects.find((subject) => subject._id === form.subjectId);
  const chaptersLoading = Boolean(form.subjectId && loadedChapterSubjectId !== form.subjectId);
  const availableSubjects = subjects.filter((subject) => subject.status === "active" || (editing && subject._id === form.subjectId));
  const availableChapters = chapters.filter((chapter) => chapter.status === "active" || (editing && chapter._id === form.chapterId));
  const options = lines(optionsText);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const answerText = form.questionType === "mcq" ? form.correctOption : form.answerText.trim();
    const payload = {
      subjectId: form.subjectId,
      chapterId: form.chapterId,
      questionText: form.questionText,
      questionType: form.questionType,
      difficulty: form.difficulty,
      answer: { text: answerText, acceptableAnswers: lines(form.acceptableAnswersText) },
      explanation: form.explanation,
      marks: Number(form.marks),
      keywords: lines(form.keywordsText).map((keyword) => keyword.toLocaleLowerCase("en")),
      status: form.status,
      ...(form.questionType === "mcq" ? { options, correctOption: form.correctOption } : {}),
    };
    try {
      const result = await requestJson<{ question: { _id: string } } & ApiData>(editing ? `/api/questions/${questionId}` : "/api/questions", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.push(`/question-bank/${result.question._id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the question.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="question-page"><AcademicLoading label={editing ? "Loading question" : "Preparing question form"} /></div>;

  return (
    <div className="question-page">
      <Link className="question-back-link" href={defaultChapterId ? `/chapters/${defaultChapterId}` : "/question-bank"}><i className="bi bi-arrow-left" aria-hidden="true" /> {defaultChapterId ? "Back to Chapter" : "Back to Question Bank"}</Link>
      <PageHeader eyebrow="QUESTION BANK" title={editing ? "Edit Question" : "Create Question"} description={selectedSubject ? `${selectedSubject.name} · ${selectedSubject.className}` : "Add a question to one of your chapters."} />
      {error && <Toast message={error} />}
      <form className="question-form" onSubmit={submit}>
        <section className="question-form-section">
          <div className="question-section-heading"><span><i className="bi bi-diagram-3" aria-hidden="true" /></span><div><h2>Location</h2><p>Choose the subject and chapter for this question.</p></div></div>
          <div className="question-field-grid">
            <div><label className="form-label" htmlFor="question-subject">Subject <span>*</span></label><select className="form-select" id="question-subject" value={form.subjectId} required onChange={(event) => { setChapters([]); setForm((current) => ({ ...current, subjectId: event.target.value, chapterId: "" })); }}><option value="">Select subject</option>{availableSubjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name} · {subject.className}{subject.status === "inactive" ? " (inactive)" : ""}</option>)}</select></div>
            <div><label className="form-label" htmlFor="question-chapter">Chapter <span>*</span></label><select className="form-select" id="question-chapter" value={form.chapterId} required disabled={!form.subjectId || chaptersLoading} onChange={(event) => update("chapterId", event.target.value)}><option value="">{chaptersLoading ? "Loading chapters..." : "Select chapter"}</option>{availableChapters.map((chapter) => <option key={chapter._id} value={chapter._id}>Chapter {chapter.chapterNumber} · {chapter.name}{chapter.status === "inactive" ? " (inactive)" : ""}</option>)}</select></div>
          </div>
        </section>
        <section className="question-form-section">
          <div className="question-section-heading"><span><i className="bi bi-ui-checks" aria-hidden="true" /></span><div><h2>Question</h2><p>Set the format, difficulty, and question wording.</p></div></div>
          <div className="question-field-grid">
            <div><label className="form-label" htmlFor="question-type">Question type <span>*</span></label><select className="form-select" id="question-type" value={form.questionType} onChange={(event) => update("questionType", event.target.value as QuestionType)}>{Object.entries(questionTypeLabels).map(([type, label]) => <option value={type} key={type}>{label}</option>)}</select></div>
            <div><label className="form-label" htmlFor="question-difficulty">Difficulty <span>*</span></label><select className="form-select" id="question-difficulty" value={form.difficulty} onChange={(event) => update("difficulty", event.target.value as QuestionDifficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
            <div className="question-field-wide"><label className="form-label" htmlFor="question-text">Question <span>*</span></label><textarea className="form-control question-textarea" id="question-text" value={form.questionText} onChange={(event) => update("questionText", event.target.value)} required maxLength={4000} rows={4} placeholder="Write the question..." /></div>
            {form.questionType === "mcq" && <>
              <div className="question-field-wide"><label className="form-label" htmlFor="question-options">Choices <span>*</span></label><textarea className="form-control" id="question-options" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} required rows={4} placeholder={"One choice per line\nPerson\nPlace\nAction\nNumber"} /><small className="question-field-hint">Enter 2 to 8 different choices, one per line.</small></div>
              <div><label className="form-label" htmlFor="question-correct-option">Correct option <span>*</span></label><select className="form-select" id="question-correct-option" value={form.correctOption} required onChange={(event) => update("correctOption", event.target.value)}><option value="">Select correct choice</option>{options.map((option, index) => <option key={`${option}-${index}`} value={option}>{option}</option>)}</select></div>
            </>}
            {form.questionType === "true_false" ? <div><label className="form-label" htmlFor="question-answer">Answer <span>*</span></label><select className="form-select" id="question-answer" value={form.answerText} required onChange={(event) => update("answerText", event.target.value)}><option value="">Select answer</option><option value="true">True</option><option value="false">False</option></select></div> : form.questionType !== "mcq" && <div className="question-field-wide"><label className="form-label" htmlFor="question-answer">Expected answer <span>*</span></label><textarea className="form-control question-textarea" id="question-answer" value={form.answerText} onChange={(event) => update("answerText", event.target.value)} required maxLength={4000} rows={3} placeholder="Enter the expected answer..." /></div>}
            <div className="question-field-wide"><label className="form-label" htmlFor="question-acceptable">Acceptable answers</label><textarea className="form-control" id="question-acceptable" value={form.acceptableAnswersText} onChange={(event) => update("acceptableAnswersText", event.target.value)} rows={3} placeholder="One equivalent answer per line" /><small className="question-field-hint">Add equivalent answers to support flexible future evaluation.</small></div>
          </div>
        </section>
        <section className="question-form-section">
          <div className="question-section-heading"><span><i className="bi bi-card-text" aria-hidden="true" /></span><div><h2>Answer guidance</h2><p>Optional context and keywords for future evaluation.</p></div></div>
          <div className="question-field-grid">
            <div className="question-field-wide"><label className="form-label" htmlFor="question-explanation">Explanation</label><textarea className="form-control" id="question-explanation" value={form.explanation} onChange={(event) => update("explanation", event.target.value)} maxLength={4000} rows={3} /></div>
            <div><label className="form-label" htmlFor="question-marks">Marks</label><select className="form-select" id="question-marks" value={form.marks} onChange={(event) => update("marks", event.target.value)}>{[1, 2, 3, 4, 5].map((mark) => <option value={mark} key={mark}>{mark}</option>)}</select></div>
            <div><label className="form-label" htmlFor="question-status">Status</label><select className="form-select" id="question-status" value={form.status} onChange={(event) => update("status", event.target.value as FormState["status"])}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="question-field-wide"><label className="form-label" htmlFor="question-keywords">Keywords</label><textarea className="form-control" id="question-keywords" value={form.keywordsText} onChange={(event) => update("keywordsText", event.target.value)} rows={2} placeholder="One keyword per line" /><small className="question-field-hint">Keywords are trimmed, lowercased, and deduplicated when saved.</small></div>
          </div>
        </section>
        <footer className="question-form-actions"><span>Question content is private to your account.</span><button className="btn btn-primary app-primary-button" type="submit" disabled={submitting || chaptersLoading || !form.chapterId}>{submitting ? "Saving..." : editing ? "Save changes" : "Create Question"}</button></footer>
      </form>
    </div>
  );
}