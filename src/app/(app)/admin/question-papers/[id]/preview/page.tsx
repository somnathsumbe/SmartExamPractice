import QuestionPaperViewPage from "@/components/question-papers/QuestionPaperViewPage";

export default async function QuestionPaperPreviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionPaperViewPage id={id} view="preview" />;
}