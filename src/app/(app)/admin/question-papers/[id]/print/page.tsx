import QuestionPaperViewPage from "@/components/question-papers/QuestionPaperViewPage";

export default async function QuestionPaperPrintRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ variant?: string }> }) {
  const [{ id }, { variant }] = await Promise.all([params, searchParams]);
  return <QuestionPaperViewPage id={id} view="print" initialVariant={variant ?? "MAIN"} />;
}