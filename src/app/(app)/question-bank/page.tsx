import { QuestionBankPage } from "@/components/question-bank/QuestionPages";
import { getCurrentUser } from "@/lib/auth";

export default async function QuestionBankRoute({ searchParams }: { searchParams: Promise<{ subjectId?: string; chapterId?: string }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  return <QuestionBankPage defaultClassName={params.chapterId ? "" : user?.profile.className ?? ""} initialSubjectId={params.subjectId} initialChapterId={params.chapterId} />;
}