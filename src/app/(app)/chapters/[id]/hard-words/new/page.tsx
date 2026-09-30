import HardWordCreatePage from "@/components/academics/HardWordCreatePage";

export default async function NewHardWordRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HardWordCreatePage chapterId={id} />;
}