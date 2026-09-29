import QuestionForm from "@/components/question-bank/QuestionForm";

export default async function NewQuestionRoute({ searchParams }: { searchParams: Promise<{ subjectId?: string; chapterId?: string }> }) {
  const params = await searchParams;
  return <QuestionForm defaultSubjectId={params.subjectId} defaultChapterId={params.chapterId} />;
}