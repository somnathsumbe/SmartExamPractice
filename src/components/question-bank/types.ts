import type { QuestionDifficulty, QuestionStatus, QuestionType } from "@/types/question";

export type QuestionAnswerView = { text: string; acceptableAnswers: string[] };

export type QuestionView = {
  _id: string;
  subjectId: string;
  chapterId: string;
  questionText: string;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  answer: QuestionAnswerView;
  explanation: string;
  marks: number;
  keywords: string[];
  status: QuestionStatus;
  options?: string[];
  correctOption?: string;
};

export type QuestionSubject = { _id: string; name: string; className: string; status: "active" | "inactive" };
export type QuestionChapter = { _id: string; subjectId: string; name: string; chapterNumber: number; className: string; status: "active" | "inactive" };
export type QuestionListItem = Pick<QuestionView, "_id" | "subjectId" | "chapterId" | "questionText" | "questionType" | "difficulty" | "marks" | "status"> & {
  variantCount: number;
  subject: { _id: string; name: string; className: string };
  chapter: { _id: string; name: string; chapterNumber: number };
};

export type QuestionVariantSummary = {
  _id: string;
  variantType: import("@/types/question-variant").QuestionVariantType;
  questionText: string;
  difficulty: import("@/types/question-variant").VariantDifficulty;
  marks: number;
  status: import("@/types/question-variant").VariantStatus;
};
