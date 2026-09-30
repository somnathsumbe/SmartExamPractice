import { NextResponse } from "next/server";
import { parseObjectId } from "@/services/academic-service";
import { QuestionPaperError, type PaperInput } from "@/services/question-paper-service";
import { isQuestionDifficulty, isQuestionType } from "@/services/question-service";
import type { QuestionDifficulty } from "@/types/question";
import type { PaperVariantSettings, QuestionPaperGenerationMode, QuestionPaperStatus } from "@/types/question-paper";
import { serverError } from "@/lib/api-response";

export function readPaperRequest(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function paperFailure(error: unknown) {
  if (error instanceof QuestionPaperError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  return serverError();
}

export function paperInvalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function paperManagerOnly(role: "parent" | "student") {
  return role === "parent" ? null : NextResponse.json({ error: "Question paper management is available only to parent accounts." }, { status: 403 });
}

function stringValue(body: Record<string, unknown>, key: string, maxLength: number, required = false): string | null {
  const value = body[key];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") return null;
  const result = value.trim();
  return (required && !result) || result.length > maxLength ? null : result;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function objectIds(value: unknown): import("mongodb").ObjectId[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = value.map((item) => typeof item === "string" ? parseObjectId(item) : null);
  return ids.every((id) => id !== null) ? ids as import("mongodb").ObjectId[] : null;
}

function parseRule(value: unknown) {
  const body = objectValue(value);
  if (!body || !isQuestionType(body.questionType)) return null;
  const { count, marks } = body;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 100) return null;
  if (typeof marks !== "number" || !Number.isInteger(marks) || marks < 1 || marks > 5) return null;
  let difficultyTargets: Partial<Record<QuestionDifficulty, number>> | undefined;
  if (body.difficultyTargets !== undefined) {
    const counts = objectValue(body.difficultyTargets);
    if (!counts) return null;
    difficultyTargets = {};
    for (const [difficulty, amount] of Object.entries(counts)) {
      if (!isQuestionDifficulty(difficulty) || typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > count) return null;
      difficultyTargets[difficulty] = amount;
    }
  }
  return { questionType: body.questionType, count, marks, ...(difficultyTargets ? { difficultyTargets } : {}) };
}

export function parseQuestionPaperInput(body: Record<string, unknown>): { input?: PaperInput; error?: string } {
  const paperName = stringValue(body, "paperName", 160, true);
  const subjectValue = stringValue(body, "subjectId", 24, true);
  const subjectId = subjectValue ? parseObjectId(subjectValue) : null;
  const className = stringValue(body, "className", 80, true);
  const examType = stringValue(body, "examType", 60, true);
  const duration = body.duration;
  const instructions = stringValue(body, "instructions", 4000);
  if (paperName === null) return { error: "Paper name is required and must be 160 characters or fewer." };
  if (!subjectId) return { error: "Select a valid subject." };
  if (className === null) return { error: "Class is required." };
  if (examType === null || !["Practice Test", "Unit Test", "Terminal Exam", "Semester Exam", "Final Exam", "Custom"].includes(examType)) return { error: "Choose a valid exam type." };
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 1 || duration > 1440) return { error: "Duration must be between 1 and 1440 minutes." };
  if (instructions === null) return { error: "Instructions must be 4000 characters or fewer." };
  const chapterIds = objectIds(body.chapterIds);
  if (!chapterIds || chapterIds.length === 0) return { error: "Select at least one valid chapter." };
  const mode = body.generationMode;
  if (mode !== "MANUAL" && mode !== "RANDOM") return { error: "Choose a valid question selection mode." };
  if (body.variantSettings !== undefined && !objectValue(body.variantSettings)) return { error: "Question paper variant settings must be an object." };
  const rawVariantSettings = objectValue(body.variantSettings) ?? {};
  const variantSettingKeys = ["shuffleQuestions", "shuffleOptions", "preventSameQuestionAtSamePosition"] as const;
  if (variantSettingKeys.some((key) => rawVariantSettings[key] !== undefined && typeof rawVariantSettings[key] !== "boolean")) return { error: "Question paper variant settings must be true or false." };
  const variantSettings: PaperVariantSettings = {
    shuffleQuestions: rawVariantSettings.shuffleQuestions !== false,
    shuffleOptions: rawVariantSettings.shuffleOptions !== false,
    preventSameQuestionAtSamePosition: rawVariantSettings.preventSameQuestionAtSamePosition !== false,
  };
  const status = body.status ?? "DRAFT";
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "ARCHIVED") return { error: "Choose a valid paper status." };
  if (!Array.isArray(body.sections) || !body.sections.length || body.sections.length > 20) return { error: "Add between one and twenty paper sections." };
  const sections: PaperInput["sections"] = [];
  for (const item of body.sections) {
    const section = objectValue(item);
    if (!section) return { error: "Check the paper section data." };
    const sectionName = stringValue(section, "sectionName", 120, true);
    const sectionInstructions = stringValue(section, "instructions", 1000);
    if (sectionName === null || sectionInstructions === null) return { error: "Each section needs a name and valid instructions." };
    if (!Array.isArray(section.questionTypes) || !section.questionTypes.length || section.questionTypes.length > 20) return { error: `Add at least one question type to section ${sectionName}.` };
    const questionTypes = section.questionTypes.map(parseRule);
    if (questionTypes.some((rule) => rule === null)) return { error: `Check the question type counts and marks in ${sectionName}.` };
    let questionIds: import("mongodb").ObjectId[] | undefined;
    if (section.questionIds !== undefined) {
      questionIds = objectIds(section.questionIds) ?? undefined;
      if (!questionIds) return { error: `One or more selected question IDs in ${sectionName} are invalid.` };
    }
    sections.push({ sectionName, instructions: sectionInstructions, questionTypes: questionTypes as NonNullable<typeof questionTypes[number]>[], ...(questionIds ? { questionIds } : {}) });
  }

  let difficultyDistribution: Partial<Record<QuestionDifficulty, number>> | undefined;
  if (body.difficultyDistribution !== undefined && body.difficultyDistribution !== null) {
    const distribution = objectValue(body.difficultyDistribution);
    if (!distribution) return { error: "Difficulty distribution must be an object." };
    difficultyDistribution = {};
    for (const [difficulty, percentage] of Object.entries(distribution)) {
      if (!isQuestionDifficulty(difficulty) || typeof percentage !== "number" || !Number.isInteger(percentage) || percentage < 0 || percentage > 100) return { error: "Difficulty percentages must be whole numbers from 0 to 100." };
      difficultyDistribution[difficulty] = percentage;
    }
    if (Object.values(difficultyDistribution).reduce<number>((sum, value) => sum + (value ?? 0), 0) !== 100) return { error: "Difficulty percentages must add up to 100." };
  }

  return { input: {
    paperName, subjectId, className, chapterIds, examType, duration, instructions, sections,
    generationMode: mode as QuestionPaperGenerationMode, variantSettings, status: status as QuestionPaperStatus,
    ...(difficultyDistribution ? { difficultyDistribution } : {}),
    useAvailableQuestions: body.useAvailableQuestions === true,
  } };
}