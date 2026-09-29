import { NextResponse } from "next/server";
import { integerField, invalidRequest, readJsonObject, statusField, stringField } from "@/lib/academic-api";
import { serverError } from "@/lib/api-response";
import { parseObjectId } from "@/services/academic-service";
import { QuestionError, isQuestionDifficulty, isQuestionType, type QuestionInput } from "@/services/question-service";
import type { QuestionStatus } from "@/types/question";

function stringList(value: unknown, maximumItems: number, maximumLength: number, normalize = false) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumItems || value.some((item) => typeof item !== "string")) return null;
  const values = value.map((item) => (item as string).trim()).filter(Boolean);
  if (values.some((item) => item.length > maximumLength)) return null;
  const normalized = values.map((item) => normalize ? item.toLocaleLowerCase("en") : item);
  return [...new Set(normalized)];
}

export function parseQuestionInput(body: Record<string, unknown>): { input?: QuestionInput; error?: string } {
  const subjectValue = stringField(body, "subjectId", 24, true);
  const chapterValue = stringField(body, "chapterId", 24, true);
  const subjectId = subjectValue ? parseObjectId(subjectValue) : null;
  const chapterId = chapterValue ? parseObjectId(chapterValue) : null;
  const questionText = stringField(body, "questionText", 4000, true);
  const explanation = stringField(body, "explanation", 4000);
  const questionType = body.questionType;
  const difficulty = body.difficulty;
  const status = statusField(body) as QuestionStatus | null;
  const parsedMarks = integerField(body, "marks", 1);
  const marks = parsedMarks ?? 1;

  if (!subjectId || !chapterId) return { error: "Select a valid subject and chapter." };
  if (questionText === null) return { error: "Question text is required and must be 4000 characters or fewer." };
  if (!isQuestionType(questionType)) return { error: "Choose a valid question type." };
  if (!isQuestionDifficulty(difficulty)) return { error: "Choose a valid difficulty." };
  if (status === null) return { error: "Choose a valid question status." };
  if (parsedMarks === null || marks > 5) return { error: "Marks must be a whole number between 1 and 5." };
  if (explanation === null) return { error: "Explanation must be 4000 characters or fewer." };

  const answerBody = readJsonObject(body.answer);
  if (!answerBody) return { error: "Enter the expected answer." };
  const answerText = stringField(answerBody, "text", 4000, true);
  if (answerText === null) return { error: "Answer is required and must be 4000 characters or fewer." };
  const acceptableAnswers = stringList(answerBody.acceptableAnswers, 20, 1000);
  if (acceptableAnswers === null) return { error: "Use up to 20 acceptable answers, each under 1000 characters." };

  let normalizedAnswer = answerText;
  let options: string[] | undefined;
  let correctOption: string | undefined;
  if (questionType === "true_false") {
    normalizedAnswer = answerText.toLocaleLowerCase("en");
    if (normalizedAnswer !== "true" && normalizedAnswer !== "false") return { error: "True/False answers must be either true or false." };
  }
  if (questionType === "mcq") {
    const parsedOptions = stringList(body.options, 8, 500);
    const selected = stringField(body, "correctOption", 500, true);
    if (!parsedOptions || parsedOptions.length < 2) return { error: "MCQ questions need at least two distinct options." };
    const distinctOptions = new Set(parsedOptions.map((option) => option.toLocaleLowerCase("en")));
    if (distinctOptions.size !== parsedOptions.length) return { error: "MCQ options must be unique." };
    if (selected === null) return { error: "Choose the correct option." };
    correctOption = parsedOptions.find((option) => option.toLocaleLowerCase("en") === selected.toLocaleLowerCase("en"));
    if (!correctOption) return { error: "The correct option must match one of the choices." };
    options = parsedOptions;
    normalizedAnswer = correctOption;
  }

  const keywords = stringList(body.keywords, 40, 80, true);
  if (keywords === null) return { error: "Use up to 40 keywords, each under 80 characters." };
  return {
    input: {
      subjectId,
      chapterId,
      questionText,
      questionType,
      difficulty,
      answer: { text: normalizedAnswer, acceptableAnswers },
      explanation,
      marks,
      keywords,
      status,
      ...(questionType === "mcq" ? { options, correctOption } : {}),
    },
  };
}

export function questionFailure(error: unknown) {
  if (error instanceof QuestionError) return NextResponse.json({ error: error.message }, { status: error.status });
  return serverError();
}

export { invalidRequest, readJsonObject };