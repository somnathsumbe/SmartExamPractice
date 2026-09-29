import { ObjectId, type Filter } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { AcademicStatus, ChapterDocument, SubjectDocument } from "@/types/academics";

const subjectsName = "subjects";
const chaptersName = "chapters";
const caseInsensitive = { locale: "en", strength: 2 } as const;

export class AcademicError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function parseObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value) ? new ObjectId(value) : null;
}

function escapeSearch(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isAcademicStatus(value: unknown): value is AcademicStatus {
  return value === "active" || value === "inactive";
}

function serializeSubject(subject: SubjectDocument) {
  return {
    _id: subject._id.toString(),
    name: subject.name,
    code: subject.code,
    className: subject.className,
    description: subject.description,
    displayOrder: subject.displayOrder,
    status: subject.status,
  };
}

function serializeChapter(chapter: ChapterDocument) {
  return {
    _id: chapter._id.toString(),
    subjectId: chapter.subjectId.toString(),
    name: chapter.name,
    chapterNumber: chapter.chapterNumber,
    className: chapter.className,
    description: chapter.description,
    displayOrder: chapter.displayOrder,
    status: chapter.status,
  };
}

export async function listSubjects(userId: ObjectId, filters: { className?: string; status?: AcademicStatus; search?: string }) {
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const query: Filter<SubjectDocument> = { userId };
  if (filters.className) query.className = filters.className;
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    const expression = new RegExp(escapeSearch(filters.search), "i");
    query.$or = [{ name: expression }, { code: expression }];
  }

  const documents = await subjects.find(query).sort({ displayOrder: 1, name: 1 }).toArray();
  const counts = new Map<string, number>();
  if (documents.length) {
    const chapters = await getCollection<ChapterDocument>(chaptersName);
    const grouped = await chapters.aggregate<{ _id: ObjectId; count: number }>([
      { $match: { userId, subjectId: { $in: documents.map((subject) => subject._id) } } },
      { $group: { _id: "$subjectId", count: { $sum: 1 } } },
    ]).toArray();
    for (const entry of grouped) counts.set(entry._id.toString(), entry.count);
  }
  return documents.map((subject) => ({ ...serializeSubject(subject), chapterCount: counts.get(subject._id.toString()) ?? 0 }));
}

export async function createSubject(userId: ObjectId, input: {
  name: string;
  code: string;
  className: string;
  description: string;
  status: AcademicStatus;
  displayOrder?: number;
}) {
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const duplicate = await subjects.findOne({ userId, className: input.className, name: input.name }, { collation: caseInsensitive });
  if (duplicate) throw new AcademicError("A subject with this name already exists for this class.", 409);

  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const last = await subjects.find({ userId, className: input.className }).sort({ displayOrder: -1 }).limit(1).next();
    displayOrder = (last?.displayOrder ?? 0) + 1;
  }
  const now = new Date();
  const subject: SubjectDocument = {
    _id: new ObjectId(), userId, name: input.name, code: input.code, className: input.className,
    description: input.description, displayOrder, status: input.status, createdAt: now, updatedAt: now,
  };
  await subjects.insertOne(subject);
  return serializeSubject(subject);
}

export async function getSubjectDetails(userId: ObjectId, subjectId: ObjectId) {
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const subject = await subjects.findOne({ _id: subjectId, userId });
  if (!subject) return null;
  const chapters = await getCollection<ChapterDocument>(chaptersName);
  const documents = await chapters.find({ userId, subjectId }).sort({ chapterNumber: 1, displayOrder: 1, name: 1 }).toArray();
  return {
    subject: serializeSubject(subject),
    chapterCount: documents.filter((chapter) => chapter.status === "active").length,
    chapters: documents.map(serializeChapter),
  };
}

export async function updateSubject(userId: ObjectId, subjectId: ObjectId, updates: Partial<Pick<SubjectDocument, "name" | "code" | "className" | "description" | "displayOrder" | "status">>) {
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const current = await subjects.findOne({ _id: subjectId, userId });
  if (!current) return null;
  const name = updates.name ?? current.name;
  const className = updates.className ?? current.className;
  if (name !== current.name || className !== current.className) {
    const duplicate = await subjects.findOne({ _id: { $ne: subjectId }, userId, className, name }, { collation: caseInsensitive });
    if (duplicate) throw new AcademicError("A subject with this name already exists for this class.", 409);
  }
  if (updates.status === "inactive" && current.status !== "inactive") {
    const chapters = await getCollection<ChapterDocument>(chaptersName);
    if (await chapters.countDocuments({ userId, subjectId, status: "active" })) {
      throw new AcademicError("Deactivate or move this subject's active chapters before deactivating the subject.", 409);
    }
  }
  const now = new Date();
  await subjects.updateOne({ _id: subjectId, userId }, { $set: { ...updates, updatedAt: now } });
  if (className !== current.className) {
    const chapters = await getCollection<ChapterDocument>(chaptersName);
    await chapters.updateMany({ userId, subjectId }, { $set: { className, updatedAt: now } });
  }
  const updated = await subjects.findOne({ _id: subjectId, userId });
  return updated ? serializeSubject(updated) : null;
}

export async function deactivateSubject(userId: ObjectId, subjectId: ObjectId) {
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const subject = await subjects.findOne({ _id: subjectId, userId });
  if (!subject) return null;
  const chapters = await getCollection<ChapterDocument>(chaptersName);
  if (await chapters.countDocuments({ userId, subjectId, status: "active" })) {
    throw new AcademicError("Deactivate or move this subject's active chapters before deactivating the subject.", 409);
  }
  await subjects.updateOne({ _id: subjectId, userId }, { $set: { status: "inactive", updatedAt: new Date() } });
  return { ...serializeSubject(subject), status: "inactive" as const };
}

export async function listChapters(userId: ObjectId, filters: { className?: string; subjectId?: ObjectId; status?: AcademicStatus; search?: string }) {
  const chapters = await getCollection<ChapterDocument>(chaptersName);
  const query: Filter<ChapterDocument> = { userId };
  if (filters.className) query.className = filters.className;
  if (filters.subjectId) query.subjectId = filters.subjectId;
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    const expression = new RegExp(escapeSearch(filters.search.trim()), "i");
    query.$or = [{ name: expression }, { description: expression }];
  }
  const documents = await chapters.find(query).sort({ displayOrder: 1, chapterNumber: 1, name: 1 }).toArray();
  if (!documents.length) return [];

  const subjectIds = [...new Map(documents.map((chapter) => [chapter.subjectId.toString(), chapter.subjectId])).values()];
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const subjectDocuments = await subjects.find({ userId, _id: { $in: subjectIds } }, { projection: { name: 1, code: 1, className: 1 } }).toArray();
  const subjectMap = new Map(subjectDocuments.map((subject) => [subject._id.toString(), subject]));
  return documents.flatMap((chapter) => {
    const subject = subjectMap.get(chapter.subjectId.toString());
    return subject ? [{
      ...serializeChapter(chapter),
      subject: { _id: subject._id.toString(), name: subject.name, code: subject.code, className: subject.className },
    }] : [];
  });
}

export async function createChapter(userId: ObjectId, input: {
  subjectId: ObjectId;
  name: string;
  className: string;
  chapterNumber?: number;
  description: string;
  displayOrder?: number;
  status: AcademicStatus;
}) {
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const subject = await subjects.findOne({ _id: input.subjectId, userId, status: "active" });
  if (!subject) throw new AcademicError("Select an active subject belonging to your account.", 404);
  if (input.className !== subject.className) throw new AcademicError("Chapter class must match the selected subject's class.", 400);

  const chapters = await getCollection<ChapterDocument>(chaptersName);
  const duplicate = await chapters.findOne({ userId, subjectId: input.subjectId, name: input.name }, { collation: caseInsensitive });
  if (duplicate) throw new AcademicError("A chapter with this name already exists for this subject.", 409);
  const lastNumber = await chapters.find({ userId, subjectId: input.subjectId }).sort({ chapterNumber: -1 }).limit(1).next();
  const lastOrder = await chapters.find({ userId, subjectId: input.subjectId }).sort({ displayOrder: -1 }).limit(1).next();
  const now = new Date();
  const chapter: ChapterDocument = {
    _id: new ObjectId(), userId, subjectId: input.subjectId, name: input.name,
    chapterNumber: input.chapterNumber ?? (lastNumber?.chapterNumber ?? 0) + 1,
    className: input.className, description: input.description,
    displayOrder: input.displayOrder ?? (lastOrder?.displayOrder ?? 0) + 1,
    status: input.status, createdAt: now, updatedAt: now,
  };
  await chapters.insertOne(chapter);
  return {
    ...serializeChapter(chapter),
    subject: { _id: subject._id.toString(), name: subject.name, code: subject.code, className: subject.className },
  };
}

export async function getChapterDetails(userId: ObjectId, chapterId: ObjectId) {
  const chapters = await getCollection<ChapterDocument>(chaptersName);
  const chapter = await chapters.findOne({ _id: chapterId, userId });
  if (!chapter) return null;
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const subject = await subjects.findOne({ _id: chapter.subjectId, userId });
  if (!subject) return null;
  return {
    chapter: serializeChapter(chapter),
    subject: { _id: subject._id.toString(), name: subject.name, code: subject.code, className: subject.className },
  };
}

export async function updateChapter(userId: ObjectId, chapterId: ObjectId, updates: Partial<Pick<ChapterDocument, "name" | "chapterNumber" | "description" | "displayOrder" | "className" | "status">> & { subjectId?: ObjectId }) {
  const chapters = await getCollection<ChapterDocument>(chaptersName);
  const current = await chapters.findOne({ _id: chapterId, userId });
  if (!current) return null;
  const subjectId = updates.subjectId ?? current.subjectId;
  const subjects = await getCollection<SubjectDocument>(subjectsName);
  const subject = await subjects.findOne({ _id: subjectId, userId });
  if (!subject) throw new AcademicError("Select a subject belonging to your account.", 404);
  if (subject.status !== "active" && (subjectId.toString() !== current.subjectId.toString() || updates.status === "active")) {
    throw new AcademicError("Select an active subject belonging to your account.", 404);
  }
  const className = updates.className ?? current.className;
  if (className !== subject.className) throw new AcademicError("Chapter class must match the selected subject's class.", 400);
  const name = updates.name ?? current.name;
  if (subjectId.toString() !== current.subjectId.toString() || name !== current.name) {
    const duplicate = await chapters.findOne({ _id: { $ne: chapterId }, userId, subjectId, name }, { collation: caseInsensitive });
    if (duplicate) throw new AcademicError("A chapter with this name already exists for this subject.", 409);
  }
  await chapters.updateOne({ _id: chapterId, userId }, { $set: { ...updates, subjectId, updatedAt: new Date() } });
  return getChapterDetails(userId, chapterId);
}

export async function deactivateChapter(userId: ObjectId, chapterId: ObjectId) {
  const chapters = await getCollection<ChapterDocument>(chaptersName);
  const chapter = await chapters.findOne({ _id: chapterId, userId });
  if (!chapter) return null;
  await chapters.updateOne({ _id: chapterId, userId }, { $set: { status: "inactive", updatedAt: new Date() } });
  return { ...serializeChapter(chapter), status: "inactive" as const };
}