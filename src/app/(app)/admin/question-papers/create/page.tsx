import QuestionPaperEditorPage from "@/components/question-papers/QuestionPaperEditorPage";

export default async function CreateQuestionPaperRoute({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <QuestionPaperEditorPage initialId={id} />;
}