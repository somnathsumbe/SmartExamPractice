import type { Document, ObjectId } from "mongodb";

export type AcademicStatus = "active" | "inactive";

export interface SubjectDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  code: string;
  className: string;
  description: string;
  displayOrder: number;
  status: AcademicStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterDocument extends Document {
  _id: ObjectId;
  userId: ObjectId;
  subjectId: ObjectId;
  name: string;
  chapterNumber: number;
  className: string;
  description: string;
  displayOrder: number;
  status: AcademicStatus;
  createdAt: Date;
  updatedAt: Date;
}