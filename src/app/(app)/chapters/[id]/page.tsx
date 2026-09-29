import { ChapterDetailPage } from "@/components/academics/AcademicDetails";

export default async function ChapterDetailsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChapterDetailPage id={id} />;
}