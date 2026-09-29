import { NextResponse } from "next/server";
import { invalidRequest, parseQuestionInput, questionFailure, readJsonObject } from "@/lib/question-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { parseObjectId } from "@/services/academic-service";
import { createQuestion, isQuestionDifficulty, isQuestionStatus, isQuestionType, listQuestions } from "@/services/question-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const params = new URL(request.url).searchParams;
    const subjectValue = params.get("subjectId");
    const chapterValue = params.get("chapterId");
    const parsedSubjectId = subjectValue ? parseObjectId(subjectValue) : null;
    const parsedChapterId = chapterValue ? parseObjectId(chapterValue) : null;
    if (subjectValue && !parsedSubjectId) return invalidRequest("The subject ID is invalid.");
    if (chapterValue && !parsedChapterId) return invalidRequest("The chapter ID is invalid.");
    const subjectId = parsedSubjectId ?? undefined;
    const chapterId = parsedChapterId ?? undefined;

    const questionTypeValue = params.get("questionType");
    const difficultyValue = params.get("difficulty");
    const statusValue = params.get("status");
    if (questionTypeValue && !isQuestionType(questionTypeValue)) return invalidRequest("Choose a valid question type.");
    if (difficultyValue && !isQuestionDifficulty(difficultyValue)) return invalidRequest("Choose a valid difficulty.");
    if (statusValue && !isQuestionStatus(statusValue)) return invalidRequest("Choose a valid question status.");

    const questions = await listQuestions(user._id, {
      subjectId,
      chapterId,
      questionType: questionTypeValue as "mcq" | "true_false" | "fill_blank" | "short_answer" | null ?? undefined,
      difficulty: difficultyValue as "easy" | "medium" | "hard" | null ?? undefined,
      status: statusValue as "active" | "inactive" | null ?? undefined,
      search: params.get("search")?.trim() || undefined,
      className: params.get("className")?.trim() || undefined,
    });
    return NextResponse.json({ questions });
  } catch (error) {
    return questionFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = readJsonObject(await request.json().catch(() => null));
    if (!body) return invalidRequest("Send a valid question form.");
    const parsed = parseQuestionInput(body);
    if (parsed.error || !parsed.input) return invalidRequest(parsed.error ?? "Check the question fields and try again.");
    const question = await createQuestion(user._id, parsed.input);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return questionFailure(error);
  }
}