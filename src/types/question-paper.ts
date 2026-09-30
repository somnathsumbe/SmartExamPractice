import type { Document, ObjectId } from "mongodb";
import type { QuestionDifficulty, QuestionType } from "@/types/question";

export type QuestionPaperStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type QuestionPaperGenerationMode = "MANUAL" | "RANDOM";
export type PaperVariantName = string;

export type PaperQuestionRule = {
  questionType: QuestionType;
  count: number;
  marks: number;
  difficultyCounts?: Partial<Record<QuestionDifficulty, number>>;
  difficultyTargets?: Partial<Record<QuestionDifficulty, number>>;
};

export type PaperQuestionSnapshot = {
  question: string;
  questionData: { options?: string[] };
  marks: number;
  difficulty: QuestionDifficulty;
  answer: { text: string; acceptableAnswers: string[] };
};

export type PaperVariantSettings = {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  preventSameQuestionAtSamePosition: boolean;
};

export type PaperQuestion = {
  questionId: ObjectId;
  chapterId: ObjectId;
  questionType: QuestionType;
  marks: number;
  order: number;
  snapshot: PaperQuestionSnapshot;
};

export type QuestionPaperSection = {
  sectionName: string;
  instructions: string;
  questionTypes: PaperQuestionRule[];
  questions: PaperQuestion[];
  totalMarks: number;
};

export interface QuestionPaperDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  paperName: string;
  subjectId: ObjectId;
  className: string;
  chapterIds: ObjectId[];
  examType: string;
  duration: number;
  totalMarks: number;
  instructions: string;
  sections: QuestionPaperSection[];
  generationMode: QuestionPaperGenerationMode;
  variantSettings: PaperVariantSettings;
  status: QuestionPaperStatus;
  createdBy: ObjectId;
  updatedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionPaperVariantDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  paperId: ObjectId;
  variant: PaperVariantName;
  sections: QuestionPaperSection[];
  totalQuestions: number;
  totalMarks: number;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}