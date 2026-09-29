"use client";

import { useState, type FormEvent } from "react";
import Toast from "@/components/common/Toast";

export type SubjectChoice = { _id: string; name: string; code: string; className: string; status: "active" | "inactive" };
export type AcademicFormValues = {
  _id?: string;
  name?: string;
  code?: string;
  className?: string;
  description?: string;
  displayOrder?: number;
  chapterNumber?: number;
  status?: "active" | "inactive";
  subjectId?: string;
};

type Props = {
  kind: "subject" | "chapter";
  initial?: AcademicFormValues;
  subjects?: SubjectChoice[];
  lockedSubject?: SubjectChoice;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
};

export default function AcademicFormDialog({ kind, initial, subjects = [], lockedSubject, submitting, error, onClose, onSave }: Props) {
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? lockedSubject?._id ?? "");
  const selectedSubject = lockedSubject ?? subjects.find((subject) => subject._id === subjectId);
  const editing = Boolean(initial?._id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
    if (kind === "subject" && initial?.status === "active" && values.status === "inactive" && !window.confirm("Deactivate this subject? It can be reactivated by editing it later.")) return;
    await onSave(values);
  }

  return (
    <div className="academic-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="academic-modal" role="dialog" aria-modal="true" aria-labelledby="academic-modal-title">
        <header className="academic-modal-header">
          <div><p className="eyebrow">{editing ? "UPDATE RECORD" : "ADD TO YOUR LEARNING PLAN"}</p><h2 id="academic-modal-title">{editing ? `Edit ${kind}` : `Add ${kind}`}</h2></div>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><i className="bi bi-x-lg" aria-hidden="true" /></button>
        </header>
        <form className="academic-form" onSubmit={submit}>
          {error && <div className="academic-form-error"><Toast message={error} /></div>}
          {kind === "chapter" && (
            <div className="academic-field academic-field-wide">
              <label className="form-label" htmlFor="academic-subject">Subject <span>*</span></label>
              {lockedSubject ? (
                <div className="academic-locked-subject" id="academic-subject"><i className="bi bi-journal-bookmark" aria-hidden="true" />{lockedSubject.name}<span>{lockedSubject.className}</span></div>
              ) : (
                <select className="form-select" id="academic-subject" name="subjectId" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required>
                  <option value="">Select subject</option>
                  {subjects.filter((subject) => subject.status === "active" || subject._id === subjectId).map((subject) => <option value={subject._id} key={subject._id}>{subject.name} · {subject.className}{subject.status === "inactive" ? " (inactive)" : ""}</option>)}
                </select>
              )}
              {lockedSubject && <input type="hidden" name="subjectId" value={lockedSubject._id} />}
            </div>
          )}
          <div className="academic-field academic-field-wide">
            <label className="form-label" htmlFor="academic-name">{kind === "subject" ? "Subject name" : "Chapter name"} <span>*</span></label>
            <input className="form-control" id="academic-name" name="name" defaultValue={initial?.name ?? ""} required maxLength={120} autoFocus />
          </div>
          {kind === "subject" ? (
            <>
              <div className="academic-field">
                <label className="form-label" htmlFor="academic-code">Code</label>
                <input className="form-control" id="academic-code" name="code" defaultValue={initial?.code ?? ""} maxLength={32} placeholder="e.g. MATH" />
              </div>
              <div className="academic-field">
                <label className="form-label" htmlFor="academic-class">Class <span>*</span></label>
                <input className="form-control" id="academic-class" name="className" defaultValue={initial?.className ?? ""} required maxLength={80} placeholder="e.g. Class 4" list="academic-classes" />
                <datalist id="academic-classes">{[...new Set(subjects.map((subject) => subject.className))].map((className) => <option value={className} key={className} />)}</datalist>
              </div>
              <div className="academic-field academic-field-wide">
                <label className="form-label" htmlFor="academic-description">Description</label>
                <textarea className="form-control" id="academic-description" name="description" defaultValue={initial?.description ?? ""} maxLength={1000} rows={3} />
              </div>
            </>
          ) : (
            <>
              <div className="academic-field">
                <label className="form-label" htmlFor="academic-number">Chapter number</label>
                <input className="form-control" id="academic-number" name="chapterNumber" type="number" min={1} step={1} defaultValue={initial?.chapterNumber ?? ""} placeholder="Assigned automatically" />
              </div>
              <div className="academic-field">
                <label className="form-label" htmlFor="academic-class">Class <span>*</span></label>
                <input className="form-control" id="academic-class" name="className" value={selectedSubject?.className ?? ""} readOnly required placeholder="Select a subject first" />
              </div>
              <div className="academic-field academic-field-wide">
                <label className="form-label" htmlFor="academic-description">Description</label>
                <textarea className="form-control" id="academic-description" name="description" defaultValue={initial?.description ?? ""} maxLength={1000} rows={3} />
              </div>
            </>
          )}
          <div className="academic-field">
            <label className="form-label" htmlFor="academic-order">Display order</label>
            <input className="form-control" id="academic-order" name="displayOrder" type="number" min={0} step={1} defaultValue={initial?.displayOrder ?? ""} placeholder="Assigned automatically" />
          </div>
          <div className="academic-field">
            <label className="form-label" htmlFor="academic-status">Status</label>
            <select className="form-select" id="academic-status" name="status" defaultValue={initial?.status ?? "active"}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <footer className="academic-modal-actions">
            <button className="btn btn-outline-secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</button>
            <button className="btn btn-primary app-primary-button" type="submit" disabled={submitting || (kind === "chapter" && !selectedSubject)}>
              {submitting ? "Saving..." : editing ? "Save changes" : `Add ${kind}`}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}