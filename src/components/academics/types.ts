import type { SubjectChoice } from "@/components/academics/AcademicFormDialog";

export type SubjectRecord = SubjectChoice & {
  description: string;
  displayOrder: number;
  chapterCount?: number;
};

export type ChapterRecord = {
  _id: string;
  subjectId: string;
  name: string;
  chapterNumber: number;
  className: string;
  description: string;
  displayOrder: number;
  status: "active" | "inactive";
  subject: SubjectChoice;
};

export type ChapterDetails = Omit<ChapterRecord, "subject"> & {
  questionCounts?: { total: number; active: number; inactive: number };
};