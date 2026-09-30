import QuestionPaperViewPage from "@/components/question-papers/QuestionPaperViewPage";

export default async function QuestionPaperAnswerKeyRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ variant?: string }> }) {
  const [{ id }, { variant }] = await Promise.all([params, searchParams]);
  return <QuestionPaperViewPage id={id} view="answer-key" initialVariant={variant ?? "MAIN"} />;
}