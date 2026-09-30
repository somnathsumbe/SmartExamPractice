import type { Document, ObjectId } from "mongodb";

export type LearningContentType = "heading" | "paragraph" | "bullet";
export type LearningStatus = "active" | "inactive";

export type LearningContentBlock = {
  type: LearningContentType;
  order: number;
  text: string;
};

export interface ChapterContentDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  subjectId: ObjectId;
  chapterId: ObjectId;
  contentType: "chapter";
  title: string;
  content: LearningContentBlock[];
  learningPoints: string[];
  status: LearningStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface HardWordDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  subjectId: ObjectId;
  chapterId: ObjectId;
  word: string;
  normalizedWord: string;
  meaning: string;
  meaningLanguage: string;
  translation: { marathi: string; hindi: string };
  partOfSpeech: string;
  pronunciation: { text: string; audioUrl: string };
  exampleSentence: string;
  synonyms: string[];
  antonyms: string[];
  practiceSettings: { targetRepetitions: number; enabled: boolean };
  status: LearningStatus;
  createdAt: Date;
  updatedAt: Date;
}