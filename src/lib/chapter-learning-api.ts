import { NextResponse } from "next/server";
import { ChapterLearningError, type ChapterContentInput, type HardWordInput } from "@/services/chapter-learning-service";
import { parseObjectId } from "@/services/academic-service";
import type { LearningContentBlock, LearningContentType, LearningStatus } from "@/types/chapter-learning";
import { serverError } from "@/lib/api-response";

export function readLearningRequest(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function learningFailure(error: unknown) {
  if (error instanceof ChapterLearningError) return NextResponse.json({ error: error.message }, { status: error.status });
  return serverError();
}

export function learningInvalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function text(body: Record<string, unknown>, field: string, maximum: number, required = false): string | null {
  const value = body[field];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") return null;
  const result = value.trim();
  if ((required && !result) || result.length > maximum) return null;
  return result;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function relationshipIds(body: Record<string, unknown>) {
  const subjectValue = text(body, "subjectId", 24, true);
  const chapterValue = text(body, "chapterId", 24, true);
  const subjectId = subjectValue ? parseObjectId(subjectValue) : null;
  const chapterId = chapterValue ? parseObjectId(chapterValue) : null;
  return subjectId && chapterId ? { subjectId, chapterId } : null;
}

function contentBlocks(value: unknown): LearningContentBlock[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const blocks: LearningContentBlock[] = [];
  const orders = new Set<number>();
  for (const item of value) {
    const block = record(item);
    if (!block || (block.type !== "heading" && block.type !== "paragraph" && block.type !== "bullet")) return null;
    if (typeof block.order !== "number" || !Number.isInteger(block.order) || block.order < 1) return null;
    if (orders.has(block.order)) return null;
    orders.add(block.order);
    if (typeof block.text !== "string" || !block.text.trim() || block.text.trim().length > 5000) return null;
    blocks.push({ type: block.type as LearningContentType, order: block.order, text: block.text.trim() });
  }
  return blocks;
}

export function parseChapterContentInput(body: Record<string, unknown>): { input?: ChapterContentInput; error?: string } {
  const ids = relationshipIds(body);
  if (!ids) return { error: "A valid subject and chapter are required." };
  const title = text(body, "title", 160, true);
  if (title === null) return { error: "Title is required and must be 160 characters or fewer." };
  const content = contentBlocks(body.content);
  if (!content) return { error: "Add at least one valid content block. Each block needs a type, text, and unique positive display order." };
  const statusValue = body.status ?? "active";
  if (statusValue !== "active" && statusValue !== "inactive") return { error: "Choose a valid content status." };
  return { input: { ...ids, title, content, status: statusValue as LearningStatus } };
}

function stringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== "string" || item.trim().length > 200)) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

export function parseHardWordInput(body: Record<string, unknown>): { input?: HardWordInput; error?: string } {
  const ids = relationshipIds(body);
  if (!ids) return { error: "A valid subject and chapter are required." };
  const word = text(body, "word", 120, true);
  const meaning = text(body, "meaning", 1000, true);
  if (word === null) return { error: "Word is required and must be 120 characters or fewer." };
  if (meaning === null) return { error: "Meaning is required and must be 1000 characters or fewer." };
  const meaningLanguage = text(body, "meaningLanguage", 60);
  const partOfSpeech = text(body, "partOfSpeech", 60);
  const exampleSentence = text(body, "exampleSentence", 1000);
  const translation = record(body.translation) ?? {};
  const pronunciation = record(body.pronunciation) ?? {};
  const practiceSettings = record(body.practiceSettings) ?? {};
  const marathi = typeof translation.marathi === "string" ? translation.marathi.trim() : "";
  const hindi = typeof translation.hindi === "string" ? translation.hindi.trim() : "";
  const pronunciationText = typeof pronunciation.text === "string" ? pronunciation.text.trim() : "";
  const audioUrl = typeof pronunciation.audioUrl === "string" ? pronunciation.audioUrl.trim() : "";
  const repetitions = practiceSettings.targetRepetitions;
  const synonyms = stringList(body.synonyms);
  const antonyms = stringList(body.antonyms);
  if (meaningLanguage === null || partOfSpeech === null || exampleSentence === null || marathi.length > 300 || hindi.length > 300 || pronunciationText.length > 200 || audioUrl.length > 2048) {
    return { error: "One or more optional fields exceed their allowed length." };
  }
  if (typeof repetitions !== "number" || !Number.isInteger(repetitions) || repetitions <= 0) return { error: "Practice repetitions must be a positive whole number." };
  if (synonyms === null || antonyms === null) return { error: "Synonyms and antonyms must be lists of text values." };
  const statusValue = body.status ?? "active";
  if (statusValue !== "active" && statusValue !== "inactive") return { error: "Choose a valid word status." };
  return { input: {
    ...ids, word, meaning, meaningLanguage, translation: { marathi, hindi }, partOfSpeech,
    pronunciation: { text: pronunciationText, audioUrl }, exampleSentence, synonyms, antonyms,
    practiceSettings: { targetRepetitions: repetitions, enabled: practiceSettings.enabled !== false },
    status: statusValue as LearningStatus,
  } };
}