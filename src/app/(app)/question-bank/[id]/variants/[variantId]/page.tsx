import QuestionVariantDetails from "@/components/question-bank/QuestionVariantDetails";

export default async function QuestionVariantDetailsRoute({ params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { id, variantId } = await params;
  return <QuestionVariantDetails questionId={id} variantId={variantId} />;
}