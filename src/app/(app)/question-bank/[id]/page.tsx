import { QuestionDetailsPage } from "@/components/question-bank/QuestionPages";

export default async function QuestionDetailsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuestionDetailsPage id={id} />;
}