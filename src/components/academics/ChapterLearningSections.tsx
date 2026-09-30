"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import AcademicConfirmDialog from "@/components/academics/AcademicConfirmDialog";
import { AcademicStatusBadge } from "@/components/academics/AcademicLists";
import AcademicLoading from "@/components/academics/AcademicLoading";
import EmptyState from "@/components/common/EmptyState";
import Toast from "@/components/common/Toast";
import type { LearningContentBlock, LearningContentType, LearningStatus } from "@/types/chapter-learning";

type ChapterContent = {
  _id: string;
  subjectId: string;
  chapterId: string;
  title: string;
  content: LearningContentBlock[];
  learningPoints: string[];
  status: LearningStatus;
};

type HardWord = {
  _id: string;
  subjectId: string;
  chapterId: string;
  word: string;
  meaning: string;
  meaningLanguage: string;
  translation: { marathi: string; hindi: string };
  partOfSpeech: string;
  pronunciation: { text: string; audioUrl: string };
  exampleSentence: string;
  synonyms: string[];
  antonyms: string[];
  practiceSettings: { targetRepetitions: number; enabled: boolean };
  status: LearningStatus;
};

type ApiData = { error?: string } & Record<string, unknown>;
type Notice = { tone: "danger" | "success"; message: string };
type ContentValues = { subjectId: string; chapterId: string; title: string; content: LearningContentBlock[]; status: LearningStatus };
type HardWordValues = Omit<HardWord, "_id">;

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

function jsonRequest(method: "POST" | "PUT", payload: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

function LearningContentForm({ initial, subjectId, chapterId, submitting, error, onClose, onSave }: {
  initial?: ChapterContent;
  subjectId: string;
  chapterId: string;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSave: (values: ContentValues) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<LearningStatus>(initial?.status ?? "active");
  const [blocks, setBlocks] = useState<LearningContentBlock[]>(initial?.content.slice().sort((a, b) => a.order - b.order) ?? []);

  function updateBlock(index: number, changes: Partial<LearningContentBlock>) {
    setBlocks((current) => current.map((block, blockIndex) => blockIndex === index ? { ...block, ...changes } : block));
  }

  function moveBlock(index: number, offset: number) {
    setBlocks((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next.map((block, blockIndex) => ({ ...block, order: blockIndex + 1 }));
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({ subjectId, chapterId, title: title.trim(), status, content: blocks.map((block) => ({ ...block, text: block.text.trim() })).sort((a, b) => a.order - b.order) });
  }

  return (
    <div className="academic-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="academic-modal chapter-content-modal" role="dialog" aria-modal="true" aria-labelledby="chapter-content-title">
        <header className="academic-modal-header">
          <div><p className="eyebrow">CHAPTER LEARNING</p><h2 id="chapter-content-title">{initial ? "Edit Learning Content" : "Add Learning Content"}</h2></div>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><i className="bi bi-x-lg" aria-hidden="true" /></button>
        </header>
        <form className="academic-form chapter-content-form" onSubmit={submit}>
          {error && <div className="academic-form-error"><Toast tone="danger" message={error} /></div>}
          <div className="academic-field academic-field-wide"><label className="form-label" htmlFor="learning-title">Title <span>*</span></label><input className="form-control" id="learning-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required /></div>
          <div className="academic-field"><label className="form-label" htmlFor="learning-status">Status</label><select className="form-select" id="learning-status" value={status} onChange={(event) => setStatus(event.target.value as LearningStatus)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          <div className="academic-field academic-field-wide">
            <div className="learning-block-heading"><div><span className="form-label">Content Blocks <span>*</span></span><p>Add headings, paragraphs, or bullet points.</p></div><button className="btn btn-outline-success btn-sm" type="button" onClick={() => setBlocks((current) => [...current, { type: "paragraph", order: Math.max(0, ...current.map((block) => block.order)) + 1, text: "" }])}><i className="bi bi-plus-lg" aria-hidden="true" /> Add block</button></div>
            {blocks.length === 0 && <p className="learning-block-empty">Add at least one block to save this learning content.</p>}
            <div className="learning-block-list">{blocks.map((block, index) => <fieldset className="learning-block-editor" key={index}>
              <legend>Block {index + 1}</legend>
              <div className="learning-block-fields">
                <div className="academic-field"><label className="form-label" htmlFor={`block-type-${index}`}>Type <span>*</span></label><select className="form-select" id={`block-type-${index}`} value={block.type} onChange={(event) => updateBlock(index, { type: event.target.value as LearningContentType })}><option value="heading">Heading</option><option value="paragraph">Paragraph</option><option value="bullet">Bullet</option></select></div>
                <div className="academic-field"><label className="form-label" htmlFor={`block-order-${index}`}>Display order <span>*</span></label><input className="form-control" id={`block-order-${index}`} type="number" min={1} step={1} value={block.order} onChange={(event) => updateBlock(index, { order: Number(event.target.value) })} required /></div>
                <div className="academic-field learning-block-text"><label className="form-label" htmlFor={`block-text-${index}`}>Text <span>*</span></label><textarea className="form-control" id={`block-text-${index}`} rows={block.type === "paragraph" ? 3 : 2} maxLength={5000} value={block.text} onChange={(event) => updateBlock(index, { text: event.target.value })} required /></div>
                <div className="learning-block-actions"><button className="icon-button" type="button" aria-label={`Move block ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => moveBlock(index, -1)}><i className="bi bi-arrow-up" aria-hidden="true" /></button><button className="icon-button" type="button" aria-label={`Move block ${index + 1} down`} title="Move down" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}><i className="bi bi-arrow-down" aria-hidden="true" /></button><button className="icon-button learning-delete-block" type="button" aria-label={`Delete block ${index + 1}`} title="Delete block" onClick={() => setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index))}><i className="bi bi-trash3" aria-hidden="true" /></button></div>
              </div>
            </fieldset>)}</div>
          </div>
          <footer className="academic-modal-actions"><button className="btn btn-outline-secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button><button className="btn btn-primary app-primary-button" type="submit" disabled={submitting || !blocks.length}>{submitting ? "Saving..." : "Save Content"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export function HardWordForm({ chapterId, subjectId, initial, submitting, error, mode, onSave, onCancel }: {
  chapterId: string;
  subjectId: string;
  initial?: HardWord;
  submitting: boolean;
  error?: string;
  mode: "page" | "dialog";
  onSave: (values: HardWordValues) => Promise<void>;
  onCancel: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const repetition = Number(value("targetRepetitions"));
    await onSave({
      subjectId, chapterId, word: value("word"), meaning: value("meaning"), meaningLanguage: value("meaningLanguage"),
      translation: { marathi: value("marathi"), hindi: value("hindi") }, partOfSpeech: value("partOfSpeech"),
      pronunciation: { text: value("pronunciationText"), audioUrl: "" }, exampleSentence: value("exampleSentence"),
      synonyms: value("synonyms").split(",").map((item) => item.trim()).filter(Boolean),
      antonyms: value("antonyms").split(",").map((item) => item.trim()).filter(Boolean),
      practiceSettings: { targetRepetitions: repetition, enabled: true },
      status: value("status") as LearningStatus,
    });
  }

  const form = <form className={`academic-form hard-word-form${mode === "page" ? " hard-word-page-form" : ""}`} onSubmit={submit}>
    {error && <div className="academic-form-error"><Toast tone="danger" message={error} /></div>}
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-word">Word <span>*</span></label><input className="form-control" id="hard-word-word" name="word" defaultValue={initial?.word ?? ""} maxLength={120} required autoFocus={mode === "page"} /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-meaning">Meaning <span>*</span></label><input className="form-control" id="hard-word-meaning" name="meaning" defaultValue={initial?.meaning ?? ""} maxLength={1000} required /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-language">Meaning language</label><input className="form-control" id="hard-word-language" name="meaningLanguage" defaultValue={initial?.meaningLanguage ?? "English"} maxLength={60} /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-pos">Part of speech</label><input className="form-control" id="hard-word-pos" name="partOfSpeech" defaultValue={initial?.partOfSpeech ?? ""} maxLength={60} placeholder="e.g. adjective" /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-marathi">Marathi meaning</label><input className="form-control" id="hard-word-marathi" name="marathi" defaultValue={initial?.translation.marathi ?? ""} maxLength={300} /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-hindi">Hindi meaning</label><input className="form-control" id="hard-word-hindi" name="hindi" defaultValue={initial?.translation.hindi ?? ""} maxLength={300} /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-pronunciation">Pronunciation text</label><input className="form-control" id="hard-word-pronunciation" name="pronunciationText" defaultValue={initial?.pronunciation.text ?? ""} maxLength={200} /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-repetitions">Practice repetitions <span>*</span></label><input className="form-control" id="hard-word-repetitions" name="targetRepetitions" type="number" min={1} step={1} list="hard-word-repetition-options" defaultValue={initial?.practiceSettings.targetRepetitions ?? 10} required /><datalist id="hard-word-repetition-options"><option value="5" /><option value="10" /><option value="20" /><option value="30" /><option value="50" /></datalist></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-status">Status</label><select className="form-select" id="hard-word-status" name="status" defaultValue={initial?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    <div className="academic-field academic-field-wide"><label className="form-label" htmlFor="hard-word-example">Example sentence</label><textarea className="form-control" id="hard-word-example" name="exampleSentence" defaultValue={initial?.exampleSentence ?? ""} maxLength={1000} rows={2} /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-synonyms">Synonyms</label><input className="form-control" id="hard-word-synonyms" name="synonyms" defaultValue={initial?.synonyms.join(", ") ?? ""} placeholder="Separate words with commas" /></div>
    <div className="academic-field"><label className="form-label" htmlFor="hard-word-antonyms">Antonyms</label><input className="form-control" id="hard-word-antonyms" name="antonyms" defaultValue={initial?.antonyms.join(", ") ?? ""} placeholder="Separate words with commas" /></div>
    <footer className="academic-modal-actions"><button className="btn btn-outline-secondary" type="button" onClick={onCancel} disabled={submitting}>{mode === "page" ? "Cancel" : "Close"}</button><button className="btn btn-primary app-primary-button" type="submit" disabled={submitting}>{submitting ? "Saving..." : initial ? "Save changes" : "Add hard word"}</button></footer>
  </form>;

  if (mode === "page") return form;
  return <div className="academic-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="academic-modal hard-word-modal" role="dialog" aria-modal="true" aria-labelledby="hard-word-modal-title"><header className="academic-modal-header"><div><p className="eyebrow">CHAPTER VOCABULARY</p><h2 id="hard-word-modal-title">Edit Hard Word</h2></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onCancel}><i className="bi bi-x-lg" aria-hidden="true" /></button></header>{form}</section></div>;
}

export default function ChapterLearningSections({ chapterId, subjectId }: { chapterId: string; subjectId: string }) {
  const [contents, setContents] = useState<ChapterContent[]>([]);
  const [words, setWords] = useState<HardWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [contentEditorOpen, setContentEditorOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<ChapterContent | undefined>();
  const [editingWord, setEditingWord] = useState<HardWord | undefined>();
  const [pendingDelete, setPendingDelete] = useState<{ type: "content" | "word"; id: string; label: string } | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      requestJson<{ contents: ChapterContent[] } & ApiData>(`/api/chapter-contents?chapterId=${chapterId}`, { signal: controller.signal }),
      requestJson<{ words: HardWord[] } & ApiData>(`/api/hard-words?chapterId=${chapterId}`, { signal: controller.signal }),
    ]).then(([contentResult, wordResult]) => {
      setContents(contentResult.contents);
      setWords(wordResult.words);
      setNotice((current) => current?.tone === "danger" ? null : current);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to load chapter learning data." });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [chapterId, refreshKey]);

  async function saveContent(values: ContentValues) {
    setSubmitting(true);
    try {
      await requestJson<ApiData>(editingContent ? `/api/chapter-contents/${editingContent._id}` : "/api/chapter-contents", jsonRequest(editingContent ? "PUT" : "POST", values));
      setEditingContent(undefined);
      setContentEditorOpen(false);
      setNotice({ tone: "success", message: editingContent ? "Learning content updated." : "Learning content added." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save learning content." });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveWord(values: HardWordValues) {
    if (!editingWord) return;
    setSubmitting(true);
    try {
      await requestJson<ApiData>(`/api/hard-words/${editingWord._id}`, jsonRequest("PUT", values));
      setEditingWord(undefined);
      setNotice({ tone: "success", message: "Hard word updated." });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to save the hard word." });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecord() {
    if (!pendingDelete) return;
    setSubmitting(true);
    try {
      const url = pendingDelete.type === "content" ? `/api/chapter-contents/${pendingDelete.id}` : `/api/hard-words/${pendingDelete.id}`;
      await requestJson<ApiData>(url, { method: "DELETE" });
      setNotice({ tone: "success", message: pendingDelete.type === "content" ? "Learning content deactivated." : "Hard word deactivated." });
      setPendingDelete(undefined);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice({ tone: "danger", message: error instanceof Error ? error.message : "Unable to deactivate this record." });
    } finally {
      setSubmitting(false);
    }
  }

  const blockCount = contents.reduce((count, item) => count + item.content.length, 0);
  return <>
    {notice && <Toast tone={notice.tone} message={notice.message} />}
    <section className="content-panel chapter-learning-section" aria-labelledby="learning-content-heading">
      <div className="academic-section-heading"><div><p className="eyebrow">LEARNING</p><h2 id="learning-content-heading">Learning Content <span className="academic-count">{blockCount} {blockCount === 1 ? "block" : "blocks"}</span></h2></div><button className="btn btn-primary app-primary-button" type="button" onClick={() => { setNotice(null); setEditingContent(undefined); setContentEditorOpen(true); }}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Content</button></div>
      {loading ? <AcademicLoading label="Loading chapter content" /> : contents.length ? <div className="chapter-content-list">{contents.map((item) => <article className="chapter-content-item" key={item._id}>
        <header className="chapter-learning-item-heading"><div><h3>{item.title}</h3><AcademicStatusBadge status={item.status} /></div><div className="chapter-item-actions"><button className="btn btn-sm btn-light" type="button" onClick={() => { setNotice(null); setEditingContent(item); setContentEditorOpen(true); }}>Edit</button>{item.status === "active" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setPendingDelete({ type: "content", id: item._id, label: item.title })}>Delete</button>}</div></header>
        <div className="chapter-content-blocks">{item.content.slice().sort((a, b) => a.order - b.order).map((block, index) => block.type === "heading" ? <h4 key={`${item._id}-${index}`}>{block.text}</h4> : block.type === "bullet" ? <ul key={`${item._id}-${index}`}><li>{block.text}</li></ul> : <p key={`${item._id}-${index}`}>{block.text}</p>)}</div>
      </article>)}</div> : <EmptyState icon="bi-journal-text" title="No learning content yet">Add structured content to help teach this chapter.</EmptyState>}
    </section>
    <section className="content-panel chapter-learning-section" aria-labelledby="hard-words-heading">
      <div className="academic-section-heading"><div><p className="eyebrow">VOCABULARY</p><h2 id="hard-words-heading">Hard Words <span className="academic-count">{words.length}</span></h2></div><Link className="btn btn-primary app-primary-button" href={`/chapters/${chapterId}/hard-words/new`}><i className="bi bi-plus-lg" aria-hidden="true" /> Add Hard Word</Link></div>
      {loading ? <AcademicLoading label="Loading hard words" /> : words.length ? <div className="academic-table-wrap"><table className="table academic-table align-middle hard-word-table"><thead><tr><th>Word</th><th>Meaning</th><th>Pronunciation</th><th>Example</th><th>Practice Target</th><th>Status</th><th>Actions</th></tr></thead><tbody>{words.map((word) => <tr key={word._id}>
        <td><strong>{word.word}</strong>{word.partOfSpeech && <span className="academic-row-description">{word.partOfSpeech}</span>}</td>
        <td>{[word.translation.marathi, word.translation.hindi, word.meaning].filter(Boolean).join(" · ")}</td>
        <td>{word.pronunciation.text || "-"}</td><td>{word.exampleSentence || "-"}</td><td>{word.practiceSettings.targetRepetitions} times</td><td><AcademicStatusBadge status={word.status} /></td>
        <td><div className="academic-row-actions"><button className="btn btn-sm btn-outline-secondary" type="button" disabled title="Practice is not available yet">Practice</button><button className="btn btn-sm btn-light" type="button" onClick={() => { setNotice(null); setEditingWord(word); }}>Edit</button>{word.status === "active" && <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setPendingDelete({ type: "word", id: word._id, label: word.word })}>Delete</button>}</div></td>
      </tr>)}</tbody></table></div> : <EmptyState icon="bi-spellcheck" title="No hard words yet">Collect difficult vocabulary for this chapter.</EmptyState>}
    </section>
    {contentEditorOpen && <LearningContentForm key={editingContent?._id ?? "new-learning-content"} initial={editingContent} subjectId={subjectId} chapterId={chapterId} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onClose={() => { if (!submitting) { setContentEditorOpen(false); setEditingContent(undefined); } }} onSave={saveContent} />}
    {editingWord && <HardWordForm chapterId={chapterId} subjectId={subjectId} initial={editingWord} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} mode="dialog" onSave={saveWord} onCancel={() => setEditingWord(undefined)} />}
    {pendingDelete && <AcademicConfirmDialog title={pendingDelete.type === "content" ? "Deactivate Learning Content?" : "Deactivate Hard Word?"} description={`"${pendingDelete.label}" will be marked inactive and retained in your chapter records.`} submitting={submitting} error={notice?.tone === "danger" ? notice.message : undefined} onCancel={() => setPendingDelete(undefined)} onConfirm={() => void deleteRecord()} />}
  </>;
}