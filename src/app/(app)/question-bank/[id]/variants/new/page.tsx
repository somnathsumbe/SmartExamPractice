import QuestionVariantForm from "@/components/question-bank/QuestionVariantForm";

export default async function NewQuestionVariantRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionVariantForm questionId={id} />;
}