"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AcademicLoading from "@/components/academics/AcademicLoading";
import { HardWordForm } from "@/components/academics/ChapterLearningSections";
import PageHeader from "@/components/common/PageHeader";

type ApiData = { error?: string } & Record<string, unknown>;
type ChapterDetails = { chapter: { _id: string; name: string }; subject: { _id: string; name: string } };
type Values = Parameters<React.ComponentProps<typeof HardWordForm>["onSave"]>[0];

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

export default function HardWordCreatePage({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<ChapterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    requestJson<ChapterDetails & ApiData>(`/api/chapters/${chapterId}`, { signal: controller.signal })
      .then(setDetails)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load the chapter."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [chapterId]);

  async function save(values: Values) {
    setSubmitting(true);
    setError("");
    try {
      await requestJson<ApiData>("/api/hard-words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      router.push(`/chapters/${chapterId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add the hard word.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="academic-page hard-word-create-page">
    <Link className="academic-back-link" href={`/chapters/${chapterId}`}><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Chapter</Link>
    {loading ? <AcademicLoading label="Loading chapter" /> : details ? <>
      <PageHeader eyebrow={`${details.subject.name} · CHAPTER CONTENT`} title="Add Hard Word" description={details.chapter.name} />
      <section className="content-panel hard-word-create-panel"><HardWordForm chapterId={chapterId} subjectId={details.subject._id} submitting={submitting} error={error} mode="page" onSave={save} onCancel={() => router.push(`/chapters/${chapterId}`)} /></section>
    </> : <section className="content-panel academic-empty-panel"><p>{error || "This chapter could not be found."}</p><Link className="btn btn-outline-success" href="/chapters">Return to Chapters</Link></section>}
  </div>;
}