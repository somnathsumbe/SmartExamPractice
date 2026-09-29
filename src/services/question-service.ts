import { ObjectId, type Filter } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getVariantCountsByQuestions } from "@/services/question-variant-service";
import type { ChapterDocument, SubjectDocument } from "@/types/academics";
import { questionTypeLabels, type QuestionDifficulty, type QuestionDocument, type QuestionStatus, type QuestionType } from "@/types/question";

const questionsCollection = "questions";
let indexCreation: Promise<void> | undefined;

export type QuestionInput = {
  subjectId: ObjectId;
  chapterId: ObjectId;
  questionText: string;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  answer: { text: string; acceptableAnswers: string[] };
  explanation: string;
  marks: number;
  keywords: string[];
  status: QuestionStatus;
  options?: string[];
  correctOption?: string;
};

export type QuestionFilters = {
  subjectId?: ObjectId;
  chapterId?: ObjectId;
  questionType?: QuestionType;
  difficulty?: QuestionDifficulty;
  status?: QuestionStatus;
  search?: string;
  className?: string;
};

export class QuestionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalizeQuestionText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && Object.hasOwn(questionTypeLabels, value);
}

export function isQuestionDifficulty(value: unknown): value is QuestionDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export function isQuestionStatus(value: unknown): value is QuestionStatus {
  return value === "active" || value === "inactive";
}

export async function ensureQuestionIndexes() {
  if (!indexCreation) {
    indexCreation = getCollection<QuestionDocument>(questionsCollection).then(async (questions) => {
      await Promise.all([
        questions.createIndex({ userId: 1, subjectId: 1, chapterId: 1 }, { name: "user_subject_chapter" }),
        questions.createIndex({ userId: 1, chapterId: 1, status: 1 }, { name: "user_chapter_status" }),
        questions.createIndex({ userId: 1, questionType: 1, difficulty: 1 }, { name: "user_type_difficulty" }),
        questions.createIndex({ userId: 1, chapterId: 1, normalizedQuestionText: 1 }, { unique: true, name: "unique_normalized_chapter_question" }),
      ]).then(() => undefined);
    }).catch((error: unknown) => {
      indexCreation = undefined;
      throw error;
    });
  }
  await indexCreation;
}

function serializeQuestion(question: QuestionDocument) {
  return {
    _id: question._id.toString(),
    subjectId: question.subjectId.toString(),
    chapterId: question.chapterId.toString(),
    questionText: question.questionText,
    questionType: question.questionType,
    difficulty: question.difficulty,
    answer: question.answer,
    explanation: question.explanation,
    marks: question.marks,
    keywords: question.keywords,
    status: question.status,
    ...(question.options ? { options: question.options } : {}),
    ...(question.correctOption ? { correctOption: question.correctOption } : {}),
  };
}

async function verifyRelationship(userId: ObjectId, subjectId: ObjectId, chapterId: ObjectId, existing?: QuestionDocument) {
  const subjects = await getCollection<SubjectDocument>("subjects");
  const chapters = await getCollection<ChapterDocument>("chapters");
  const [subject, chapter] = await Promise.all([
    subjects.findOne({ _id: subjectId, userId }),
    chapters.findOne({ _id: chapterId, userId }),
  ]);
  if (!subject) throw new QuestionError("Subject not found.", 404);
  if (!chapter) throw new QuestionError("Chapter not found.", 404);
  if (chapter.subjectId.toString() !== subject._id.toString()) throw new QuestionError("The selected chapter does not belong to this subject.", 400);
  if (!existing && (subject.status !== "active" || chapter.status !== "active")) throw new QuestionError("Questions can only be added to active subjects and chapters.", 400);
  if (existing && (subjectId.toString() !== existing.subjectId.toString() || chapterId.toString() !== existing.chapterId.toString()) && (subject.status !== "active" || chapter.status !== "active")) {
    throw new QuestionError("Move a question only to an active subject and chapter.", 400);
  }
  return { subject, chapter };
}

async function findDuplicate(userId: ObjectId, chapterId: ObjectId, questionText: string, excludeId?: ObjectId) {
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const normalizedQuestionText = normalizeQuestionText(questionText);
  const query: Filter<QuestionDocument> = { userId, chapterId, normalizedQuestionText };
  if (excludeId) query._id = { $ne: excludeId };
  return questions.findOne(query, { projection: { _id: 1 } });
}

export async function listQuestions(userId: ObjectId, filters: QuestionFilters) {
  await ensureQuestionIndexes();
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const query: Filter<QuestionDocument> = { userId };
  const subjects = await getCollection<SubjectDocument>("subjects");
  if (filters.subjectId && !(await subjects.findOne({ _id: filters.subjectId, userId }, { projection: { _id: 1 } }))) {
    throw new QuestionError("Subject not found.", 404);
  }
  const subjectQuery: Filter<SubjectDocument> = { userId };
  if (filters.className) subjectQuery.className = filters.className;
  if (filters.subjectId) subjectQuery._id = filters.subjectId;
  const matchingSubjects = await subjects.find(subjectQuery, { projection: { _id: 1 } }).toArray();
  if (filters.className || filters.subjectId) {
    if (!matchingSubjects.length) return [];
    query.subjectId = { $in: matchingSubjects.map((subject) => subject._id) };
  }

  if (filters.chapterId) {
    const chapters = await getCollection<ChapterDocument>("chapters");
    const chapter = await chapters.findOne({ _id: filters.chapterId, userId });
    if (!chapter) throw new QuestionError("Chapter not found.", 404);
    if (filters.subjectId && chapter.subjectId.toString() !== filters.subjectId.toString()) throw new QuestionError("The selected chapter does not belong to this subject.", 400);
    query.chapterId = filters.chapterId;
  }
  if (filters.questionType) query.questionType = filters.questionType;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "i");
    query.$or = [{ questionText: expression }, { explanation: expression }];
  }

  const documents = await questions.find(query).sort({ createdAt: -1, _id: -1 }).toArray();
  if (!documents.length) return [];
  const variantCounts = await getVariantCountsByQuestions(userId, documents.map((question) => question._id));
  const chapterIds = [...new Map(documents.map((question) => [question.chapterId.toString(), question.chapterId])).values()];
  const chapterCollection = await getCollection<ChapterDocument>("chapters");
  const [matchingChapters, questionSubjects] = await Promise.all([
    chapterCollection.find({ _id: { $in: chapterIds }, userId }, { projection: { name: 1, chapterNumber: 1, className: 1, subjectId: 1 } }).toArray(),
    subjects.find({ _id: { $in: [...new Map(documents.map((question) => [question.subjectId.toString(), question.subjectId])).values()] }, userId }, { projection: { name: 1, className: 1 } }).toArray(),
  ]);
  const chapterMap = new Map(matchingChapters.map((chapter) => [chapter._id.toString(), chapter]));
  const subjectMap = new Map(questionSubjects.map((subject) => [subject._id.toString(), subject]));
  return documents.flatMap((question) => {
    const chapter = chapterMap.get(question.chapterId.toString());
    const subject = subjectMap.get(question.subjectId.toString());
    if (!chapter || !subject || chapter.subjectId.toString() !== subject._id.toString()) return [];
    return [{
      _id: question._id.toString(),
      subjectId: question.subjectId.toString(),
      chapterId: question.chapterId.toString(),
      questionText: question.questionText,
      questionType: question.questionType,
      difficulty: question.difficulty,
      marks: question.marks,
      status: question.status,
      variantCount: variantCounts.get(question._id.toString()) ?? 0,
      subject: { _id: subject._id.toString(), name: subject.name, className: subject.className },
      chapter: { _id: chapter._id.toString(), name: chapter.name, chapterNumber: chapter.chapterNumber },
    }];
  });
}

export async function createQuestion(userId: ObjectId, input: QuestionInput) {
  await ensureQuestionIndexes();
  await verifyRelationship(userId, input.subjectId, input.chapterId);
  if (await findDuplicate(userId, input.chapterId, input.questionText)) throw new QuestionError("A similar question already exists in this chapter.", 409);
  const now = new Date();
  const question: QuestionDocument = {
    _id: new ObjectId(), userId, subjectId: input.subjectId, chapterId: input.chapterId,
    questionText: input.questionText,
    normalizedQuestionText: normalizeQuestionText(input.questionText),
    questionType: input.questionType, difficulty: input.difficulty,
    answer: input.answer, explanation: input.explanation, marks: input.marks,
    keywords: input.keywords, status: input.status,
    ...(input.questionType === "mcq" ? { options: input.options, correctOption: input.correctOption } : {}),
    createdAt: now, updatedAt: now,
  };
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  try {
    await questions.insertOne(question);
  } catch (error) {
    if (isDuplicateKey(error)) throw new QuestionError("A similar question already exists in this chapter.", 409);
    throw error;
  }
  return serializeQuestion(question);
}

export async function getQuestionDetails(userId: ObjectId, questionId: ObjectId) {
  await ensureQuestionIndexes();
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const question = await questions.findOne({ _id: questionId, userId });
  if (!question) return null;
  const { subject, chapter } = await verifyRelationship(userId, question.subjectId, question.chapterId, question);
  return {
    question: serializeQuestion(question),
    subject: { _id: subject._id.toString(), name: subject.name, className: subject.className },
    chapter: { _id: chapter._id.toString(), name: chapter.name, chapterNumber: chapter.chapterNumber },
  };
}

export async function updateQuestion(userId: ObjectId, questionId: ObjectId, input: QuestionInput) {
  await ensureQuestionIndexes();
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const current = await questions.findOne({ _id: questionId, userId });
  if (!current) return null;
  await verifyRelationship(userId, input.subjectId, input.chapterId, current);
  if (await findDuplicate(userId, input.chapterId, input.questionText, questionId)) throw new QuestionError("A similar question already exists in this chapter.", 409);
  const updatedAt = new Date();
  const update: Partial<QuestionDocument> = {
    subjectId: input.subjectId,
    chapterId: input.chapterId,
    questionText: input.questionText,
    normalizedQuestionText: normalizeQuestionText(input.questionText),
    questionType: input.questionType,
    difficulty: input.difficulty,
    answer: input.answer,
    explanation: input.explanation,
    marks: input.marks,
    keywords: input.keywords,
    status: input.status,
    updatedAt,
  };
  const updateDocument = input.questionType === "mcq"
    ? { $set: { ...update, options: input.options, correctOption: input.correctOption } }
    : { $set: update, $unset: { options: "", correctOption: "" } };
  try {
    await questions.updateOne({ _id: questionId, userId }, updateDocument);
  } catch (error) {
    if (isDuplicateKey(error)) throw new QuestionError("A similar question already exists in this chapter.", 409);
    throw error;
  }
  return getQuestionDetails(userId, questionId);
}

export async function deactivateQuestion(userId: ObjectId, questionId: ObjectId) {
  await ensureQuestionIndexes();
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const result = await questions.findOneAndUpdate({ _id: questionId, userId }, { $set: { status: "inactive", updatedAt: new Date() } }, { returnDocument: "after" });
  return result ? serializeQuestion(result) : null;
}

export async function getChapterQuestionCounts(userId: ObjectId, chapterId: ObjectId) {
  await ensureQuestionIndexes();
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const groups = await questions.aggregate<{ _id: QuestionStatus; count: number }>([
    { $match: { userId, chapterId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]).toArray();
  const counts = { total: 0, active: 0, inactive: 0 };
  for (const group of groups) {
    counts[group._id] = group.count;
    counts.total += group.count;
  }
  return counts;
}

export async function getQuestionCountsByChapters(userId: ObjectId, chapterIds: ObjectId[]) {
  const counts = new Map<string, { total: number; active: number; inactive: number }>();
  if (!chapterIds.length) return counts;
  await ensureQuestionIndexes();
  const questions = await getCollection<QuestionDocument>(questionsCollection);
  const groups = await questions.aggregate<{ _id: { chapterId: ObjectId; status: QuestionStatus }; count: number }>([
    { $match: { userId, chapterId: { $in: chapterIds } } },
    { $group: { _id: { chapterId: "$chapterId", status: "$status" }, count: { $sum: 1 } } },
  ]).toArray();
  for (const chapterId of chapterIds) counts.set(chapterId.toString(), { total: 0, active: 0, inactive: 0 });
  for (const group of groups) {
    const chapterCounts = counts.get(group._id.chapterId.toString());
    if (chapterCounts) {
      chapterCounts[group._id.status] = group.count;
      chapterCounts.total += group.count;
    }
  }
  return counts;
}

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}