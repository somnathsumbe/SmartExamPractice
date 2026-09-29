"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import AcademicLoading from "@/components/academics/AcademicLoading";
import PageHeader from "@/components/common/PageHeader";
import Toast from "@/components/common/Toast";
import type { QuestionView } from "@/components/question-bank/types";
import type { MatchingPair, QuestionVariantContent, QuestionVariantType, SupportedQuestionVariantType, VariantDifficulty } from "@/types/question-variant";

type ApiData = { error?: string } & Record<string, unknown>;
type ParentDetails = {
  question: QuestionView;
  subject: { _id: string; name: string; className: string };
  chapter: { _id: string; name: string; chapterNumber: number };
};
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
type VariantDetails = { variant: VariantRecord; question: { _id: string; questionText: string }; subject: { _id: string; name: string }; chapter: { _id: string; name: string; chapterNumber: number } };

export const variantTypeLabels: Record<QuestionVariantType, string> = {
  mcq: "MCQ",
  true_false: "True / False",
  fill_blank: "Fill in the Blanks",
  one_sentence: "One Sentence Answer",
  short_answer: "Short Answer",
  match_following: "Match the Pairs",
  match_pairs: "Match Word to Meaning",
  one_word: "One Word",
  long_answer: "Long Answer",
  rhyming_words: "Rhyming Words",
  opposite_words: "Opposite Words",
  unscramble: "Unscramble",
  sentence_making: "Sentence Making",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  sequencing: "Sequencing",
  creative_writing: "Creative Writing",
  dialogue: "Dialogue",
  picture_based: "Picture Based",
  activity_based: "Activity Based",
};

const variantTypes: SupportedQuestionVariantType[] = ["mcq", "fill_blank", "true_false", "match_pairs", "one_word", "short_answer", "long_answer", "rhyming_words", "opposite_words", "unscramble", "sentence_making", "vocabulary", "grammar", "sequencing", "creative_writing", "dialogue", "picture_based", "activity_based"];
const contentTextFields = ["scrambledText", "prompt", "word", "subtype", "topic", "instructions", "pictureReference", "activityType", "activityInstructions", "teacherNotes"] as const;
const contentListFields = ["items", "correctOrder", "words", "expectedKeyPoints", "speakerNames", "dialogueLines"] as const;
type ContentFormValues = Record<typeof contentTextFields[number] | typeof contentListFields[number], string>;

function emptyContent(): ContentFormValues {
  return { scrambledText: "", prompt: "", word: "", subtype: "", topic: "", instructions: "", pictureReference: "", activityType: "", activityInstructions: "", teacherNotes: "", items: "", correctOrder: "", words: "", expectedKeyPoints: "", speakerNames: "", dialogueLines: "" };
}

function contentToForm(content?: QuestionVariantContent): ContentFormValues {
  const result = emptyContent();
  if (!content) return result;
  for (const key of contentTextFields) result[key] = content[key] ?? "";
  for (const key of contentListFields) result[key] = content[key]?.join("\n") ?? "";
  return result;
}

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

function splitLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function initialPairs(): MatchingPair[] {
  return [{ left: "", right: "" }, { left: "", right: "" }];
}

export default function QuestionVariantForm({ questionId, variantId }: { questionId: string; variantId?: string }) {
  const router = useRouter();
  const editing = Boolean(variantId);
  const [parent, setParent] = useState<ParentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [variantType, setVariantType] = useState<QuestionVariantType>("mcq");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [answerText, setAnswerText] = useState("");
  const [acceptableAnswers, setAcceptableAnswers] = useState("");
  const [pairs, setPairs] = useState<MatchingPair[]>(initialPairs);
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<VariantDifficulty>("easy");
  const [marks, setMarks] = useState("1");
  const [keywords, setKeywords] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [contentValues, setContentValues] = useState<ContentFormValues>(emptyContent);

  useEffect(() => {
    const controller = new AbortController();
    const parentRequest = requestJson<ParentDetails & ApiData>(`/api/questions/${questionId}`, { signal: controller.signal });
    const variantRequest = variantId ? requestJson<VariantDetails & ApiData>(`/api/question-variants/${variantId}`, { signal: controller.signal }) : null;
    Promise.all([parentRequest, variantRequest]).then(([parentResult, variantResult]) => {
      setParent(parentResult);
      if (!variantResult) return;
      if (variantResult.variant.questionId !== questionId) throw new Error("This variant does not belong to the selected question.");
      const current = variantResult.variant;
      setVariantType(current.variantType === "match_following" ? "match_pairs" : current.variantType === "one_sentence" ? "short_answer" : current.variantType);
      setQuestionText(current.questionText);
      setOptions(current.content?.options?.length ? current.content.options : current.options?.length ? current.options : ["", ""]);
      setAnswerText(current.answer.text);
      setAcceptableAnswers(current.answer.acceptableAnswers.join("\n"));
      setPairs(current.content?.pairs?.length ? current.content.pairs : current.pairs?.length ? current.pairs : initialPairs());
      setContentValues(contentToForm(current.content));
      setExplanation(current.explanation);
      setDifficulty(current.difficulty);
      setMarks(String(current.marks));
      setKeywords(current.keywords.join("\n"));
      setStatus(current.status);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load variant details.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [questionId, variantId]);

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, currentIndex) => currentIndex === index ? value : option));
  }

  function updatePair(index: number, key: keyof MatchingPair, value: string) {
    setPairs((current) => current.map((pair, currentIndex) => currentIndex === index ? { ...pair, [key]: value } : pair));
  }

  function updateContent(key: keyof ContentFormValues, value: string) {
    setContentValues((current) => ({ ...current, [key]: value }));
  }

  function contentTextField(key: keyof ContentFormValues, label: string, rows = 2) {
    return <div className="variant-field-wide" key={key}><label className="form-label" htmlFor={`variant-content-${key}`}>{label}</label><textarea className="form-control" id={`variant-content-${key}`} value={contentValues[key]} onChange={(event) => updateContent(key, event.target.value)} rows={rows} /></div>;
  }

  function contentSelect(key: keyof ContentFormValues, label: string, choices: [string, string][]) {
    return <div key={key}><label className="form-label" htmlFor={`variant-content-${key}`}>{label} <span>*</span></label><select className="form-select" id={`variant-content-${key}`} value={contentValues[key]} required onChange={(event) => updateContent(key, event.target.value)}><option value="">Choose {label.toLocaleLowerCase("en")}</option>{choices.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></div>;
  }

  const questionLabels: Partial<Record<QuestionVariantType, string>> = { fill_blank: "Sentence", true_false: "Statement", match_pairs: "Instruction", match_following: "Instruction", activity_based: "Activity title", picture_based: "Question" };
  const longAnswer = variantType === "long_answer" || variantType === "creative_writing" || variantType === "dialogue";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!parent) return;
    setSaving(true);
    const payload = {
      questionId,
      subjectId: parent.subject._id,
      chapterId: parent.chapter._id,
      variantType,
      questionText,
      ...(variantType === "mcq" ? { options: options.map((option) => option.trim()), correctOption: answerText } : {}),
      answer: {
        text: answerText,
        acceptableAnswers: splitLines(acceptableAnswers),
        ...(variantType === "rhyming_words" ? { expectedItems: splitLines(contentValues.words) } : {}),
      },
      ...((variantType === "match_pairs" || variantType === "match_following") ? { pairs } : {}),
      content: {
        ...(variantType === "mcq" ? { options: options.map((option) => option.trim()) } : {}),
        ...((variantType === "match_pairs" || variantType === "match_following") ? { pairs } : {}),
        ...Object.fromEntries(contentTextFields.filter((key) => contentValues[key].trim()).map((key) => [key, contentValues[key].trim()])),
        ...Object.fromEntries(contentListFields.filter((key) => splitLines(contentValues[key]).length).map((key) => [key, splitLines(contentValues[key])])),
      },
      explanation,
      difficulty,
      marks: Number(marks),
      keywords: splitLines(keywords).map((keyword) => keyword.toLocaleLowerCase("en")),
      status,
    };
    try {
      const result = await requestJson<{ variant: { _id: string } } & ApiData>(variantId ? `/api/question-variants/${variantId}` : "/api/question-variants", {
        method: variantId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.push(`/question-bank/${questionId}/variants/${result.variant._id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this variant.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="question-page"><AcademicLoading label={editing ? "Loading variant" : "Loading parent question"} /></div>;
  if (!parent) return <div className="question-page"><Toast message={error || "Question not found."} /><Link className="btn btn-outline-success" href="/question-bank">Back to Question Bank</Link></div>;

  return (
    <div className="question-page variant-page">
      <Link className="question-back-link" href={variantId ? `/question-bank/${questionId}/variants/${variantId}` : `/question-bank/${questionId}`}><i className="bi bi-arrow-left" aria-hidden="true" /> {variantId ? "Back to Variant" : "Back to Question"}</Link>
      <PageHeader eyebrow="QUESTION VARIANTS" title={editing ? "Edit Variant" : "Add Variant"} description="Create another practice format for the same concept." />
      {error && <Toast message={error} />}
      <section className="variant-parent-summary">
        <div><span>Parent Question</span><strong>{parent.question.questionText}</strong></div>
        <div><span>Subject</span><strong>{parent.subject.name}</strong></div>
        <div><span>Chapter</span><strong>Chapter {parent.chapter.chapterNumber} · {parent.chapter.name}</strong></div>
      </section>
      <form className="question-form" onSubmit={submit}>
        <section className="question-form-section">
          <div className="question-section-heading"><span><i className="bi bi-shuffle" aria-hidden="true" /></span><div><h2>Practice format</h2><p>Select one format for this version of the concept.</p></div></div>
          <div className="variant-field-grid">
            <div><label className="form-label" htmlFor="variant-type">Variant Type <span>*</span></label><select className="form-select" id="variant-type" value={variantType} onChange={(event) => setVariantType(event.target.value as QuestionVariantType)}>{variantTypes.map((type) => <option value={type} key={type}>{variantTypeLabels[type]}</option>)}</select></div>
            <div><label className="form-label" htmlFor="variant-difficulty">Difficulty <span>*</span></label><select className="form-select" id="variant-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as VariantDifficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
            <div className="variant-field-wide"><label className="form-label" htmlFor="variant-question">{questionLabels[variantType] ?? "Question"} <span>*</span></label><textarea className="form-control question-textarea" id="variant-question" value={questionText} onChange={(event) => setQuestionText(event.target.value)} required maxLength={4000} rows={4} placeholder="Write a clear question for this practice format..." /></div>
            {variantType === "mcq" && <div className="variant-field-wide"><div className="variant-options-heading"><label className="form-label">Options <span>*</span></label><button className="btn btn-sm btn-outline-success" type="button" disabled={options.length >= 4} onClick={() => setOptions((current) => [...current, ""])}><i className="bi bi-plus-lg" aria-hidden="true" /> Add option</button></div><div className="variant-options-grid">{options.map((option, index) => <div className="variant-option-field" key={index}><label className="form-label" htmlFor={`variant-option-${index}`}>Option {String.fromCharCode(65 + index)} <span>*</span></label><div className="variant-option-control"><input className="form-control" id={`variant-option-${index}`} value={option} required onChange={(event) => updateOption(index, event.target.value)} maxLength={500} />{options.length > 2 && <button className="icon-button" type="button" aria-label={`Remove option ${String.fromCharCode(65 + index)}`} onClick={() => { setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index)); if (answerText === option) setAnswerText(""); }}><i className="bi bi-x-lg" aria-hidden="true" /></button>}</div></div>)}</div><small className="question-field-hint">Use between 2 and 4 answer choices.</small></div>}
            {variantType === "opposite_words" && contentTextField("word", "Word", 1)}
            {variantType === "unscramble" && contentTextField("scrambledText", "Scrambled word or sentence", 2)}
            {variantType === "sentence_making" && contentTextField("words", "Given word or words", 2)}
            {variantType === "rhyming_words" && contentTextField("words", "Expected rhyming words, one per line", 3)}
            {variantType === "vocabulary" && <>{contentTextField("word", "Vocabulary word", 1)}{contentSelect("subtype", "Vocabulary task", [["meaning", "Meaning"], ["synonym", "Synonym"], ["antonym", "Antonym"], ["word_usage", "Word usage"]])}</>}
            {variantType === "grammar" && contentSelect("subtype", "Grammar topic", [["pronoun", "Pronoun"], ["noun", "Noun"], ["verb", "Verb"], ["adjective", "Adjective"], ["article", "Article"], ["tense", "Tense"], ["singular_plural", "Singular / Plural"], ["gender", "Gender"], ["other", "Other"]])}
            {variantType === "sequencing" && <>{contentTextField("items", "Items to arrange, one per line", 4)}{contentTextField("correctOrder", "Correct order, one item per line", 4)}</>}
            {variantType === "creative_writing" && <>{contentSelect("subtype", "Writing format", [["paragraph", "Paragraph"], ["poem", "Poem"], ["story", "Story"], ["description", "Description"], ["guided_writing", "Guided writing"]])}{contentTextField("topic", "Topic", 2)}{contentTextField("prompt", "Prompt", 3)}{contentTextField("instructions", "Instructions", 3)}{contentTextField("expectedKeyPoints", "Expected key points, one per line", 4)}</>}
            {variantType === "dialogue" && <>{contentSelect("subtype", "Dialogue task", [["complete", "Complete a dialogue"], ["create", "Create a dialogue"]])}{contentTextField("speakerNames", "Speaker names, one per line", 2)}{contentTextField("dialogueLines", "Dialogue lines, one per line", 4)}{contentTextField("expectedKeyPoints", "Expected key points, one per line", 3)}</>}
            {variantType === "picture_based" && contentTextField("pictureReference", "Picture URL or application-relative path", 2)}
            {variantType === "activity_based" && <>{contentSelect("activityType", "Activity type", [["observation", "Observation"], ["discussion", "Discussion"], ["role_play", "Role play"], ["other", "Other"]])}{contentTextField("activityInstructions", "Activity instructions", 4)}{contentTextField("expectedKeyPoints", "Expected response or key points, one per line", 3)}{contentTextField("teacherNotes", "Teacher notes", 3)}</>}
            {variantType === "true_false" ? <fieldset className="variant-field-wide variant-answer-field"><legend className="form-label">Correct Answer <span>*</span></legend><label className="variant-radio"><input type="radio" name="variant-answer" value="true" checked={answerText === "true"} required onChange={() => setAnswerText("true")} /><span>True</span></label><label className="variant-radio"><input type="radio" name="variant-answer" value="false" checked={answerText === "false"} required onChange={() => setAnswerText("false")} /><span>False</span></label></fieldset> : variantType === "match_pairs" || variantType === "match_following" ? (
              <div className="variant-field-wide">
                <div className="variant-options-heading"><label className="form-label">Matching pairs <span>*</span></label><button className="btn btn-sm btn-outline-success" type="button" disabled={pairs.length >= 10} onClick={() => setPairs((current) => [...current, { left: "", right: "" }])}><i className="bi bi-plus-lg" aria-hidden="true" /> Add pair</button></div>
                <div className="variant-pairs-grid"><strong>Column A</strong><strong>Column B</strong>{pairs.map((pair, index) => <div className="variant-pair-row" key={index}><input className="form-control" aria-label={`Column A item ${index + 1}`} value={pair.left} required maxLength={300} onChange={(event) => updatePair(index, "left", event.target.value)} placeholder={`Item ${index + 1}`} /><input className="form-control" aria-label={`Column B match ${index + 1}`} value={pair.right} required maxLength={300} onChange={(event) => updatePair(index, "right", event.target.value)} placeholder="Matching answer" />{pairs.length > 2 && <button className="icon-button variant-remove-pair" type="button" aria-label={`Remove pair ${index + 1}`} onClick={() => setPairs((current) => current.filter((_, pairIndex) => pairIndex !== index))}><i className="bi bi-x-lg" aria-hidden="true" /></button>}</div>)}</div>
                <small className="question-field-hint">Add 2 to 10 pairs. Pair data is stored as structured rows.</small>
              </div>
            ) : <div className="variant-field-wide"><label className="form-label" htmlFor="variant-answer">{variantType === "one_word" ? "Expected one-word answer" : longAnswer ? "Model answer or expected guidance" : variantType === "short_answer" ? "Model answer" : "Expected answer"}{!["activity_based", "picture_based", "creative_writing", "dialogue", "rhyming_words", "sequencing"].includes(variantType) && <> <span>*</span></>}</label><textarea className="form-control question-textarea" id="variant-answer" value={answerText} onChange={(event) => setAnswerText(event.target.value)} required={!["activity_based", "picture_based", "creative_writing", "dialogue", "rhyming_words", "sequencing"].includes(variantType)} maxLength={4000} rows={longAnswer ? 5 : 3} placeholder={variantType === "one_word" ? "One word" : "Enter the expected answer..."} /></div>}
            {variantType === "mcq" && <div className="variant-field-wide"><label className="form-label" htmlFor="variant-correct-answer">Correct Answer <span>*</span></label><select className="form-select" id="variant-correct-answer" value={answerText} required onChange={(event) => setAnswerText(event.target.value)}><option value="">Select the correct option</option>{options.filter((option) => option.trim()).map((option, index) => <option value={option} key={`${index}-${option}`}>{option}</option>)}</select></div>}
            <div className="variant-field-wide"><label className="form-label" htmlFor="variant-acceptable-answers">Acceptable Answers</label><textarea className="form-control" id="variant-acceptable-answers" value={acceptableAnswers} onChange={(event) => setAcceptableAnswers(event.target.value)} rows={3} placeholder="One equivalent answer per line" /><small className="question-field-hint">Equivalent responses are kept for future flexible answer evaluation.</small></div>
          </div>
        </section>
        <section className="question-form-section">
          <div className="question-section-heading"><span><i className="bi bi-card-text" aria-hidden="true" /></span><div><h2>Answer guidance</h2><p>Optional context for learning and future evaluation.</p></div></div>
          <div className="variant-field-grid">
            <div className="variant-field-wide"><label className="form-label" htmlFor="variant-explanation">Explanation</label><textarea className="form-control" id="variant-explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={4000} rows={3} /></div>
            <div><label className="form-label" htmlFor="variant-marks">Marks</label><select className="form-select" id="variant-marks" value={marks} onChange={(event) => setMarks(event.target.value)}>{[1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100].map((mark) => <option value={mark} key={mark}>{mark}</option>)}</select></div>
            <div><label className="form-label" htmlFor="variant-status">Status</label><select className="form-select" id="variant-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div className="variant-field-wide"><label className="form-label" htmlFor="variant-keywords">Keywords</label><textarea className="form-control" id="variant-keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} rows={2} placeholder="One keyword per line" /><small className="question-field-hint">Keywords are trimmed, lowercased, and deduplicated when saved.</small></div>
          </div>
        </section>
        <footer className="question-form-actions"><span>Variant belongs to the selected parent Question.</span><button className="btn btn-primary app-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create Variant"}</button></footer>
      </form>
    </div>
  );
}