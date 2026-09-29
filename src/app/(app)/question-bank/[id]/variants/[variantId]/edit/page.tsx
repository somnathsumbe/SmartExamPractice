import QuestionVariantForm from "@/components/question-bank/QuestionVariantForm";

export default async function EditQuestionVariantRoute({ params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { id, variantId } = await params;
  return <QuestionVariantForm questionId={id} variantId={variantId} />;
}