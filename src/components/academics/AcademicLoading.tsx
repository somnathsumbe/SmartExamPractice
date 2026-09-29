import SmartLoader from "@/components/common/SmartLoader";

export default function AcademicLoading({ label }: { label: string }) {
  return (
    <section className="academic-loading" aria-busy="true">
      <SmartLoader label={label} />
      <div className="academic-loading-lines" aria-hidden="true"><span /><span /><span /><span /></div>
    </section>
  );
}