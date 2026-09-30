import { ObjectId, type Filter } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { ChapterDocument, SubjectDocument } from "@/types/academics";
import type { QuestionDocument } from "@/types/question";
import type { QuestionVariantContent, QuestionVariantDocument, QuestionVariantType, VariantStatus } from "@/types/question-variant";

const collectionName = "questionVariants";
let indexCreation: Promise<void> | undefined;

export type QuestionVariantInput = {
  questionId: ObjectId;
  subjectId: ObjectId;
  chapterId: ObjectId;
  variantType: QuestionVariantType;
  questionText: string;
  options?: string[];
  answer: { text: string; acceptableAnswers: string[]; expectedItems?: string[] };
  pairs?: { left: string; right: string }[];
  content?: QuestionVariantContent;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  keywords: string[];
  status: VariantStatus;
};

export class QuestionVariantError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function isQuestionVariantType(value: unknown): value is QuestionVariantType {
  return value === "mcq" || value === "fill_blank" || value === "true_false" || value === "match_pairs" || value === "one_word" || value === "short_answer" || value === "long_answer" || value === "rhyming_words" || value === "opposite_words" || value === "unscramble" || value === "sentence_making" || value === "vocabulary" || value === "grammar" || value === "sequencing" || value === "creative_writing" || value === "dialogue" || value === "picture_based" || value === "activity_based" || value === "one_sentence" || value === "match_following";
}

export function isVariantDifficulty(value: unknown): value is "easy" | "medium" | "hard" {
  return value === "easy" || value === "medium" || value === "hard";
}

export function isVariantStatus(value: unknown): value is VariantStatus {
  return value === "active" || value === "inactive";
}

export async function ensureQuestionVariantIndexes() {
  if (!indexCreation) {
    indexCreation = getCollection<QuestionVariantDocument>(collectionName).then(async (variants) => {
      await Promise.all([
        variants.createIndex({ userId: 1, questionId: 1, status: 1 }, { name: "user_question_status" }),
        variants.createIndex({ userId: 1, subjectId: 1, chapterId: 1, variantType: 1 }, { name: "user_subject_chapter_type" }),
        variants.createIndex(
          { userId: 1, questionId: 1, variantType: 1, normalizedQuestionText: 1 },
          { name: "unique_active_question_variant", unique: true, partialFilterExpression: { status: "active" } },
        ),
      ]).then(() => undefined);
    }).catch((error: unknown) => {
      indexCreation = undefined;
      throw error;
    });
  }
  await indexCreation;
}

function serializeVariant(variant: QuestionVariantDocument) {
  return {
    _id: variant._id.toString(),
    questionId: variant.questionId.toString(),
    subjectId: variant.subjectId.toString(),
    chapterId: variant.chapterId.toString(),
    variantType: variant.variantType,
    questionText: variant.questionText,
    ...(variant.options ? { options: variant.options } : {}),
    answer: variant.answer,
    ...(variant.pairs ? { pairs: variant.pairs } : {}),
    ...(variant.content ? { content: variant.content } : {}),
    explanation: variant.explanation,
    difficulty: variant.difficulty,
    marks: variant.marks,
    keywords: variant.keywords,
    status: variant.status,
  };
}

async function verifyParent(userId: ObjectId, questionId: ObjectId) {
  const questions = await getCollection<QuestionDocument>("questions");
  const question = await questions.findOne({ _id: questionId, userId });
  if (!question) throw new QuestionVariantError("Question not found.", 404);
  const subjects = await getCollection<SubjectDocument>("subjects");
  const chapters = await getCollection<ChapterDocument>("chapters");
  const [subject, chapter] = await Promise.all([
    subjects.findOne({ _id: question.subjectId, userId }),
    chapters.findOne({ _id: question.chapterId, userId }),
  ]);
  if (!subject) throw new QuestionVariantError("Subject not found.", 404);
  if (!chapter) throw new QuestionVariantError("Chapter not found.", 404);
  if (chapter.subjectId.toString() !== subject._id.toString()) throw new QuestionVariantError("The question has an invalid subject and chapter relationship.", 409);
  return { question, subject, chapter };
}

async function findDuplicate(userId: ObjectId, questionId: ObjectId, variantType: QuestionVariantType, questionText: string, excludeId?: ObjectId) {
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const query: Filter<QuestionVariantDocument> = {
    userId,
    questionId,
    variantType,
    normalizedQuestionText: normalize(questionText),
    status: "active",
  };
  if (excludeId) query._id = { $ne: excludeId };
  return variants.findOne(query, { projection: { _id: 1 } });
}

export async function listQuestionVariants(userId: ObjectId, filters: {
  questionId?: ObjectId;
  subjectId?: ObjectId;
  chapterId?: ObjectId;
  variantType?: QuestionVariantType;
  difficulty?: "easy" | "medium" | "hard";
  status?: VariantStatus;
  search?: string;
}) {
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const query: Filter<QuestionVariantDocument> = { userId };
  if (filters.questionId) {
    await verifyParent(userId, filters.questionId);
    query.questionId = filters.questionId;
  }
  if (filters.subjectId) {
    const subjects = await getCollection<SubjectDocument>("subjects");
    if (!(await subjects.findOne({ _id: filters.subjectId, userId }, { projection: { _id: 1 } }))) throw new QuestionVariantError("Subject not found.", 404);
    query.subjectId = filters.subjectId;
  }
  if (filters.chapterId) {
    const chapters = await getCollection<ChapterDocument>("chapters");
    const chapter = await chapters.findOne({ _id: filters.chapterId, userId }, { projection: { _id: 1, subjectId: 1 } });
    if (!chapter) throw new QuestionVariantError("Chapter not found.", 404);
    if (filters.subjectId && chapter.subjectId.toString() !== filters.subjectId.toString()) throw new QuestionVariantError("The selected chapter does not belong to this subject.", 400);
    query.chapterId = filters.chapterId;
  }
  if (filters.variantType) query.variantType = filters.variantType;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    const expression = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ questionText: expression }, { explanation: expression }];
  }
  const documents = await variants.find(query).sort({ createdAt: -1, _id: -1 }).toArray();
  return documents.map(serializeVariant);
}

export async function createQuestionVariant(userId: ObjectId, input: QuestionVariantInput) {
  await ensureQuestionVariantIndexes();
  const { question } = await verifyParent(userId, input.questionId);
  if (question.subjectId.toString() !== input.subjectId.toString() || question.chapterId.toString() !== input.chapterId.toString()) {
    throw new QuestionVariantError("Variant subject and chapter must match the parent question.", 400);
  }
  if (await findDuplicate(userId, input.questionId, input.variantType, input.questionText)) {
    throw new QuestionVariantError("A similar variant already exists for this question.", 409);
  }
  const now = new Date();
  const variant: QuestionVariantDocument = {
    ...input,
    _id: new ObjectId(),
    userId,
    normalizedQuestionText: normalize(input.questionText),
    createdAt: now,
    updatedAt: now,
  };
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  try {
    await variants.insertOne(variant);
  } catch (error) {
    if (isDuplicateKey(error)) throw new QuestionVariantError("A similar variant already exists for this question.", 409);
    throw error;
  }
  return serializeVariant(variant);
}

export async function getQuestionVariantDetails(userId: ObjectId, variantId: ObjectId) {
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const variant = await variants.findOne({ _id: variantId, userId });
  if (!variant) return null;
  const { question, subject, chapter } = await verifyParent(userId, variant.questionId);
  if (question.subjectId.toString() !== variant.subjectId.toString() || question.chapterId.toString() !== variant.chapterId.toString() || chapter.subjectId.toString() !== subject._id.toString()) {
    throw new QuestionVariantError("The variant relationship is no longer valid.", 409);
  }
  return {
    variant: serializeVariant(variant),
    question: { _id: question._id.toString(), questionText: question.questionText },
    subject: { _id: subject._id.toString(), name: subject.name },
    chapter: { _id: chapter._id.toString(), name: chapter.name, chapterNumber: chapter.chapterNumber },
  };
}

export async function updateQuestionVariant(userId: ObjectId, variantId: ObjectId, input: QuestionVariantInput) {
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const existing = await variants.findOne({ _id: variantId, userId });
  if (!existing) return null;
  if (input.questionId.toString() !== existing.questionId.toString()) throw new QuestionVariantError("A variant cannot be moved to another question.", 400);
  const { question } = await verifyParent(userId, existing.questionId);
  if (question.subjectId.toString() !== input.subjectId.toString() || question.chapterId.toString() !== input.chapterId.toString()) {
    throw new QuestionVariantError("Variant subject and chapter must match the parent question.", 400);
  }
  if (input.status === "active" && await findDuplicate(userId, existing.questionId, input.variantType, input.questionText, variantId)) {
    throw new QuestionVariantError("A similar variant already exists for this question.", 409);
  }
  const { options, pairs, content, ...fields } = input;
  const update = {
    ...fields,
    normalizedQuestionText: normalize(input.questionText),
    updatedAt: new Date(),
    ...(options ? { options } : {}),
    ...(pairs ? { pairs } : {}),
    ...(content ? { content } : {}),
  };
  try {
    const unset = {
      ...(!options ? { options: "" } : {}),
      ...(!pairs ? { pairs: "" } : {}),
      ...(!content ? { content: "" } : {}),
    };
    await variants.updateOne({ _id: variantId, userId }, Object.keys(unset).length ? { $set: update, $unset: unset } : { $set: update });
  } catch (error) {
    if (isDuplicateKey(error)) throw new QuestionVariantError("A similar variant already exists for this question.", 409);
    throw error;
  }
  return getQuestionVariantDetails(userId, variantId);
}

export async function deactivateQuestionVariant(userId: ObjectId, variantId: ObjectId) {
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const result = await variants.findOneAndUpdate({ _id: variantId, userId }, { $set: { status: "inactive", updatedAt: new Date() } }, { returnDocument: "after" });
  return result ? serializeVariant(result) : null;
}

export async function getVariantCountsByQuestions(userId: ObjectId, questionIds: ObjectId[]) {
  const counts = new Map<string, number>();
  if (!questionIds.length) return counts;
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const groups = await variants.aggregate<{ _id: ObjectId; count: number }>([
    { $match: { userId, questionId: { $in: questionIds } } },
    { $group: { _id: "$questionId", count: { $sum: 1 } } },
  ]).toArray();
  for (const id of questionIds) counts.set(id.toString(), 0);
  for (const group of groups) counts.set(group._id.toString(), group.count);
  return counts;
}

export async function getChapterVariantCount(userId: ObjectId, chapterId: ObjectId) {
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  return variants.countDocuments({ userId, chapterId });
}

export async function getQuestionVariantSummaries(userId: ObjectId, questionId: ObjectId) {
  await verifyParent(userId, questionId);
  await ensureQuestionVariantIndexes();
  const variants = await getCollection<QuestionVariantDocument>(collectionName);
  const documents = await variants.find({ userId, questionId }).sort({ createdAt: 1, _id: 1 }).project({
    _id: 1,
    variantType: 1,
    questionText: 1,
    difficulty: 1,
    marks: 1,
    status: 1,
  }).toArray();
  return documents.map((variant) => ({
    _id: variant._id.toString(),
    variantType: variant.variantType,
    questionText: variant.questionText,
    difficulty: variant.difficulty,
    marks: variant.marks,
    status: variant.status,
  }));
}

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}