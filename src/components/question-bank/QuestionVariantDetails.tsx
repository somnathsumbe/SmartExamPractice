"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AcademicConfirmDialog from "@/components/academics/AcademicConfirmDialog";
import AcademicLoading from "@/components/academics/AcademicLoading";
import { AcademicStatusBadge } from "@/components/academics/AcademicLists";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import { variantTypeLabels } from "@/components/question-bank/QuestionVariantForm";
import type { MatchingPair, QuestionVariantContent, QuestionVariantType, VariantDifficulty } from "@/types/question-variant";

type ApiData = { error?: string } & Record<string, unknown>;
type VariantRecord = {
  _id: string;
  questionId: string;
  subjectId: string;
  chapterId: string;
  variantType: QuestionVariantType;
  questionText: string;
  options?: string[];
  answer: { text: string; acceptableAnswers: string[]; expectedItems?: string[] };
  pairs?: MatchingPair[];
  content?: QuestionVariantContent;
  explanation: string;
  difficulty: VariantDifficulty;
  marks: number;
  keywords: string[];
  status: "active" | "inactive";
};
type Details = {
  variant: VariantRecord;
  question: { _id: string; questionText: string };
  subject: { _id: string; name: string };
  chapter: { _id: string; name: string; chapterNumber: number };
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

export default function QuestionVariantDetails({ questionId, variantId }: { questionId: string; variantId: string }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    requestJson<Details & ApiData>(`/api/question-variants/${variantId}`, { signal: controller.signal })
      .then((result) => {
        if (result.variant.questionId !== questionId) throw new Error("This variant does not belong to the selected question.");
        setDetails(result);
        setError("");
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load variant details."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [questionId, variantId, refreshKey]);

  async function deactivate() {
    setDeactivating(true);
    try {
      await requestJson<ApiData>(`/api/question-variants/${variantId}`, { method: "DELETE" });
      setConfirmDeactivate(false);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to deactivate this variant.");
    } finally {
      setDeactivating(false);
    }
  }

  if (loading) return <div className="question-page"><AcademicLoading label="Loading variant details" /></div>;
  if (!details) return <div className="question-page"><Toast message={error || "Question variant not found."} /><Link className="btn btn-outline-success" href={`/question-bank/${questionId}`}>Back to Question</Link></div>;
  const variant = details.variant;

  return (
    <div className="question-page question-detail-page">
      <Link className="question-back-link" href={`/question-bank/${questionId}`}><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Question</Link>
      <nav className="academic-breadcrumb question-breadcrumb" aria-label="Breadcrumb"><ol><li><Link href="/question-bank">Question Bank</Link></li><li><Link href={`/subjects/${details.subject._id}`}>{details.subject.name}</Link></li><li><Link href={`/chapters/${details.chapter._id}`}>{details.chapter.name}</Link></li><li><Link href={`/question-bank/${questionId}`}>Question</Link></li><li aria-current="page">{variantTypeLabels[variant.variantType]}</li></ol></nav>
      {error && <Toast message={error} />}
      <PageHeader eyebrow="QUESTION VARIANT" title={variantTypeLabels[variant.variantType]} description={`${details.subject.name} · ${details.chapter.name}`} />
      <div className="question-detail-actions"><Link className="btn btn-outline-secondary" href={`/question-bank/${questionId}`}>Parent Question</Link><Link className="btn btn-primary app-primary-button" href={`/question-bank/${questionId}/variants/${variantId}/edit`}><i className="bi bi-pencil" aria-hidden="true" /> Edit</Link><button className="btn btn-outline-danger" type="button" onClick={() => setConfirmDeactivate(true)}>Delete</button></div>
      <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">CONCEPT</p><h2>Parent Question</h2></div><p className="question-readable-text">{details.question.questionText}</p></section>
      <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">VARIANT</p><h2>Variant Information</h2></div><dl className="question-meta-grid">
        <div><dt>Variant Type</dt><dd>{variantTypeLabels[variant.variantType]}</dd></div>
        <div><dt>Subject</dt><dd><Link href={`/subjects/${details.subject._id}`}>{details.subject.name}</Link></dd></div>
        <div><dt>Chapter</dt><dd><Link href={`/chapters/${details.chapter._id}`}>Chapter {details.chapter.chapterNumber} · {details.chapter.name}</Link></dd></div>
        <div><dt>Difficulty</dt><dd className="text-capitalize">{variant.difficulty}</dd></div>
        <div><dt>Marks</dt><dd>{variant.marks}</dd></div>
        <div><dt>Status</dt><dd><AcademicStatusBadge status={variant.status} /></dd></div>
      </dl></section>
      <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">PROMPT</p><h2>Question</h2></div><p className="question-readable-text">{variant.questionText}</p></section>
      {(variant.content?.options ?? variant.options)?.length ? <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">CHOICES</p><h2>Options</h2></div><ol className="variant-detail-options">{(variant.content?.options ?? variant.options ?? []).map((option) => <li className={option === variant.answer.text ? "is-correct" : ""} key={option}>{option}{option === variant.answer.text && <span>Correct Answer</span>}</li>)}</ol></section> : null}
      {(variant.content?.pairs ?? variant.pairs)?.length ? <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">MATCHING</p><h2>Pairs</h2></div><div className="variant-pairs-display"><strong>Column A</strong><strong>Column B</strong>{(variant.content?.pairs ?? variant.pairs ?? []).map((pair, index) => <div className="variant-pairs-display-row" key={`${pair.left}-${index}`}><span>{pair.left}</span><span>{pair.right}</span></div>)}</div></section> : null}
      {variant.content && <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">FORMAT DETAILS</p><h2>Additional Content</h2></div><dl className="question-meta-grid">
        {variant.content.subtype && <div><dt>Format</dt><dd>{variant.content.subtype.replaceAll("_", " ")}</dd></div>}
        {variant.content.word && <div><dt>Word</dt><dd>{variant.content.word}</dd></div>}
        {variant.content.scrambledText && <div><dt>Scrambled text</dt><dd>{variant.content.scrambledText}</dd></div>}
        {variant.content.topic && <div><dt>Topic</dt><dd>{variant.content.topic}</dd></div>}
        {variant.content.prompt && <div><dt>Prompt</dt><dd>{variant.content.prompt}</dd></div>}
        {variant.content.instructions && <div><dt>Instructions</dt><dd>{variant.content.instructions}</dd></div>}
        {variant.content.pictureReference && <div><dt>Picture reference</dt><dd>{variant.content.pictureReference}</dd></div>}
        {variant.content.activityType && <div><dt>Activity type</dt><dd>{variant.content.activityType.replaceAll("_", " ")}</dd></div>}
        {variant.content.activityInstructions && <div><dt>Activity instructions</dt><dd>{variant.content.activityInstructions}</dd></div>}
        {variant.content.teacherNotes && <div><dt>Teacher notes</dt><dd>{variant.content.teacherNotes}</dd></div>}
      </dl>
      {variant.content.items?.length ? <div className="question-alternatives"><h3>Items</h3><ol>{variant.content.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></div> : null}
      {variant.content.correctOrder?.length ? <div className="question-alternatives"><h3>Correct order</h3><ol>{variant.content.correctOrder.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></div> : null}
      {variant.content.words?.length ? <div className="question-alternatives"><h3>Words</h3><ul>{variant.content.words.map((word, index) => <li key={`${word}-${index}`}>{word}</li>)}</ul></div> : null}
      {variant.content.speakerNames?.length ? <div className="question-alternatives"><h3>Speakers</h3><ul>{variant.content.speakerNames.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul></div> : null}
      {variant.content.dialogueLines?.length ? <div className="question-alternatives"><h3>Dialogue</h3><ol>{variant.content.dialogueLines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ol></div> : null}
      {variant.content.expectedKeyPoints?.length ? <div className="question-alternatives"><h3>Expected key points</h3><ul>{variant.content.expectedKeyPoints.map((point, index) => <li key={`${point}-${index}`}>{point}</li>)}</ul></div> : null}</section>}
      {variant.answer.text && <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">EXPECTED RESPONSE</p><h2>Correct Answer</h2></div><p className="question-readable-text">{variant.answer.text}</p>{variant.answer.acceptableAnswers.length > 0 && <div className="question-alternatives"><h3>Acceptable Answers</h3><ul>{variant.answer.acceptableAnswers.map((answer) => <li key={answer}>{answer}</li>)}</ul></div>}</section>}
      {variant.explanation && <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">GUIDANCE</p><h2>Explanation</h2></div><p className="question-readable-text">{variant.explanation}</p></section>}
      {variant.keywords.length > 0 && <section className="question-detail-section"><div className="question-detail-heading"><p className="eyebrow">CONCEPTS</p><h2>Keywords</h2></div><ul className="question-keywords">{variant.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}</ul></section>}
      {confirmDeactivate && <AcademicConfirmDialog title="Delete variant?" description="This variant will be soft deleted and marked inactive. The parent Question and other variants are unchanged." submitting={deactivating} error={error || undefined} onCancel={() => setConfirmDeactivate(false)} onConfirm={() => void deactivate()} />}
    </div>
  );
}