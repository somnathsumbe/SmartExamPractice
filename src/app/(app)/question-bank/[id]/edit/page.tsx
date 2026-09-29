import QuestionForm from "@/components/question-bank/QuestionForm";

export default async function EditQuestionRoute({ params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  return <QuestionForm questionId={routeParams.id} />;
}