import { SubjectDetailPage } from "@/components/academics/AcademicDetails";

export default async function SubjectDetailsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubjectDetailPage id={id} />;
}