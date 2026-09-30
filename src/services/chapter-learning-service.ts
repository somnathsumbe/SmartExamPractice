import { ObjectId, type Filter } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { ChapterDocument, SubjectDocument } from "@/types/academics";
import type { ChapterContentDocument, HardWordDocument, LearningContentBlock, LearningStatus } from "@/types/chapter-learning";

const chapterContentsCollection = "chapterContents";
const hardWordsCollection = "hardWords";
let indexCreation: Promise<void> | undefined;

export class ChapterLearningError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type ChapterContentInput = {
  subjectId: ObjectId;
  chapterId: ObjectId;
  title: string;
  content: LearningContentBlock[];
  status: LearningStatus;
};

export type HardWordInput = {
  subjectId: ObjectId;
  chapterId: ObjectId;
  word: string;
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
};

function serializeChapterContent(document: ChapterContentDocument) {
  return {
    _id: document._id.toString(),
    subjectId: document.subjectId.toString(),
    chapterId: document.chapterId.toString(),
    contentType: document.contentType,
    title: document.title,
    content: document.content,
    learningPoints: document.learningPoints,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function serializeHardWord(document: HardWordDocument) {
  return {
    _id: document._id.toString(),
    subjectId: document.subjectId.toString(),
    chapterId: document.chapterId.toString(),
    word: document.word,
    meaning: document.meaning,
    meaningLanguage: document.meaningLanguage,
    translation: document.translation,
    partOfSpeech: document.partOfSpeech,
    pronunciation: document.pronunciation,
    exampleSentence: document.exampleSentence,
    synonyms: document.synonyms,
    antonyms: document.antonyms,
    practiceSettings: document.practiceSettings,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function ensureChapterLearningIndexes() {
  if (!indexCreation) {
    indexCreation = Promise.all([
      getCollection<ChapterContentDocument>(chapterContentsCollection).then((collection) => collection.createIndex(
        { userId: 1, subjectId: 1, chapterId: 1, status: 1 }, { name: "user_subject_chapter_status" },
      )),
      getCollection<HardWordDocument>(hardWordsCollection).then(async (collection) => {
        await Promise.all([
          collection.createIndex({ userId: 1, subjectId: 1, chapterId: 1, status: 1 }, { name: "user_subject_chapter_status" }),
          collection.createIndex({ userId: 1, chapterId: 1, word: 1 }, { name: "user_chapter_word" }),
          collection.createIndex(
            { userId: 1, chapterId: 1, normalizedWord: 1 },
            { name: "unique_active_chapter_word", unique: true, partialFilterExpression: { status: "active" } },
          ),
        ]);
      }),
    ]).then(() => undefined).catch((error: unknown) => {
      indexCreation = undefined;
      throw error;
    });
  }
  await indexCreation;
}

async function verifyChapterRelationship(userId: ObjectId, subjectId: ObjectId, chapterId: ObjectId) {
  const [subjects, chapters] = await Promise.all([
    getCollection<SubjectDocument>("subjects"),
    getCollection<ChapterDocument>("chapters"),
  ]);
  const [subject, chapter] = await Promise.all([
    subjects.findOne({ _id: subjectId, userId }),
    chapters.findOne({ _id: chapterId, userId }),
  ]);
  if (!subject) throw new ChapterLearningError("Subject not found.", 404);
  if (!chapter) throw new ChapterLearningError("Chapter not found.", 404);
  if (!chapter.subjectId.equals(subject._id)) throw new ChapterLearningError("The selected chapter does not belong to this subject.", 400);
  return { subject, chapter };
}

async function verifyStoredRelationship(userId: ObjectId, document: { subjectId: ObjectId; chapterId: ObjectId }) {
  try {
    await verifyChapterRelationship(userId, document.subjectId, document.chapterId);
    return true;
  } catch (error) {
    if (error instanceof ChapterLearningError) return false;
    throw error;
  }
}

export async function getChapterLearningScope(userId: ObjectId, chapterId: ObjectId) {
  const chapters = await getCollection<ChapterDocument>("chapters");
  const chapter = await chapters.findOne({ _id: chapterId, userId });
  if (!chapter) throw new ChapterLearningError("Chapter not found.", 404);
  const { subject } = await verifyChapterRelationship(userId, chapter.subjectId, chapterId);
  return { subjectId: subject._id, chapterId: chapter._id };
}

export async function listChapterContents(userId: ObjectId, subjectId: ObjectId, chapterId: ObjectId) {
  await ensureChapterLearningIndexes();
  await verifyChapterRelationship(userId, subjectId, chapterId);
  const collection = await getCollection<ChapterContentDocument>(chapterContentsCollection);
  const documents = await collection.find({ userId, subjectId, chapterId } satisfies Filter<ChapterContentDocument>)
    .sort({ createdAt: 1, _id: 1 }).toArray();
  return documents.map(serializeChapterContent);
}

export async function createChapterContent(userId: ObjectId, input: ChapterContentInput) {
  await ensureChapterLearningIndexes();
  await verifyChapterRelationship(userId, input.subjectId, input.chapterId);
  const now = new Date();
  const document: ChapterContentDocument = {
    _id: new ObjectId(), userId, subjectId: input.subjectId, chapterId: input.chapterId,
    contentType: "chapter", title: input.title, content: input.content,
    learningPoints: input.content.filter((block) => block.type === "bullet").map((block) => block.text),
    status: input.status, createdAt: now, updatedAt: now,
  };
  const collection = await getCollection<ChapterContentDocument>(chapterContentsCollection);
  await collection.insertOne(document);
  return serializeChapterContent(document);
}

export async function getChapterContent(userId: ObjectId, id: ObjectId) {
  await ensureChapterLearningIndexes();
  const collection = await getCollection<ChapterContentDocument>(chapterContentsCollection);
  const document = await collection.findOne({ _id: id, userId });
  if (!document || !(await verifyStoredRelationship(userId, document))) return null;
  return serializeChapterContent(document);
}

export async function updateChapterContent(userId: ObjectId, id: ObjectId, updates: Partial<Pick<ChapterContentInput, "title" | "content" | "status">> & { subjectId?: ObjectId; chapterId?: ObjectId }) {
  await ensureChapterLearningIndexes();
  const collection = await getCollection<ChapterContentDocument>(chapterContentsCollection);
  const current = await collection.findOne({ _id: id, userId });
  if (!current || !(await verifyStoredRelationship(userId, current))) return null;
  const subjectId = updates.subjectId ?? current.subjectId;
  const chapterId = updates.chapterId ?? current.chapterId;
  await verifyChapterRelationship(userId, subjectId, chapterId);
  const content = updates.content ?? current.content;
  await collection.updateOne({ _id: id, userId }, {
    $set: {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.content !== undefined ? { content, learningPoints: content.filter((block) => block.type === "bullet").map((block) => block.text) } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      subjectId, chapterId, updatedAt: new Date(),
    },
  });
  return getChapterContent(userId, id);
}

export async function deactivateChapterContent(userId: ObjectId, id: ObjectId) {
  await ensureChapterLearningIndexes();
  const collection = await getCollection<ChapterContentDocument>(chapterContentsCollection);
  const current = await collection.findOne({ _id: id, userId });
  if (!current || !(await verifyStoredRelationship(userId, current))) return null;
  await collection.updateOne({ _id: id, userId }, { $set: { status: "inactive", updatedAt: new Date() } });
  return getChapterContent(userId, id);
}

export async function listHardWords(userId: ObjectId, subjectId: ObjectId, chapterId: ObjectId) {
  await ensureChapterLearningIndexes();
  await verifyChapterRelationship(userId, subjectId, chapterId);
  const collection = await getCollection<HardWordDocument>(hardWordsCollection);
  const documents = await collection.find({ userId, subjectId, chapterId } satisfies Filter<HardWordDocument>)
    .sort({ word: 1, _id: 1 }).toArray();
  return documents.map(serializeHardWord);
}

async function findActiveDuplicate(userId: ObjectId, chapterId: ObjectId, word: string, excludeId?: ObjectId) {
  const query: Filter<HardWordDocument> = { userId, chapterId, normalizedWord: word.trim().toLocaleLowerCase("en"), status: "active" };
  if (excludeId) query._id = { $ne: excludeId };
  const collection = await getCollection<HardWordDocument>(hardWordsCollection);
  return collection.findOne(query, { projection: { _id: 1 } });
}

export async function createHardWord(userId: ObjectId, input: HardWordInput) {
  await ensureChapterLearningIndexes();
  await verifyChapterRelationship(userId, input.subjectId, input.chapterId);
  if (input.status === "active" && await findActiveDuplicate(userId, input.chapterId, input.word)) {
    throw new ChapterLearningError("This active word already exists in the chapter.", 409);
  }
  const now = new Date();
  const document: HardWordDocument = {
    _id: new ObjectId(), userId, subjectId: input.subjectId, chapterId: input.chapterId,
    word: input.word, normalizedWord: input.word.trim().toLocaleLowerCase("en"), meaning: input.meaning,
    meaningLanguage: input.meaningLanguage, translation: input.translation, partOfSpeech: input.partOfSpeech,
    pronunciation: input.pronunciation, exampleSentence: input.exampleSentence, synonyms: input.synonyms,
    antonyms: input.antonyms, practiceSettings: input.practiceSettings, status: input.status,
    createdAt: now, updatedAt: now,
  };
  const collection = await getCollection<HardWordDocument>(hardWordsCollection);
  try {
    await collection.insertOne(document);
  } catch (error) {
    if (isDuplicateKey(error)) throw new ChapterLearningError("This active word already exists in the chapter.", 409);
    throw error;
  }
  return serializeHardWord(document);
}

export async function getHardWord(userId: ObjectId, id: ObjectId) {
  await ensureChapterLearningIndexes();
  const collection = await getCollection<HardWordDocument>(hardWordsCollection);
  const document = await collection.findOne({ _id: id, userId });
  if (!document || !(await verifyStoredRelationship(userId, document))) return null;
  return serializeHardWord(document);
}

export async function updateHardWord(userId: ObjectId, id: ObjectId, input: HardWordInput) {
  await ensureChapterLearningIndexes();
  const collection = await getCollection<HardWordDocument>(hardWordsCollection);
  const current = await collection.findOne({ _id: id, userId });
  if (!current || !(await verifyStoredRelationship(userId, current))) return null;
  await verifyChapterRelationship(userId, input.subjectId, input.chapterId);
  const normalizedWord = input.word.trim().toLocaleLowerCase("en");
  if (input.status === "active" && await findActiveDuplicate(userId, input.chapterId, input.word, id)) {
    throw new ChapterLearningError("This active word already exists in the chapter.", 409);
  }
  try {
    await collection.updateOne({ _id: id, userId }, { $set: {
      ...input, normalizedWord, updatedAt: new Date(),
    } });
  } catch (error) {
    if (isDuplicateKey(error)) throw new ChapterLearningError("This active word already exists in the chapter.", 409);
    throw error;
  }
  return getHardWord(userId, id);
}

export async function deactivateHardWord(userId: ObjectId, id: ObjectId) {
  await ensureChapterLearningIndexes();
  const collection = await getCollection<HardWordDocument>(hardWordsCollection);
  const current = await collection.findOne({ _id: id, userId });
  if (!current || !(await verifyStoredRelationship(userId, current))) return null;
  await collection.updateOne({ _id: id, userId }, { $set: { status: "inactive", updatedAt: new Date() } });
  return getHardWord(userId, id);
}