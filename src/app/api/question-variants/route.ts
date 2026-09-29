import { NextResponse } from "next/server";
import { questionVariantFailure, invalidRequest, parseQuestionVariantInput, readJsonObject } from "@/lib/question-variant-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { parseObjectId } from "@/services/academic-service";
import { createQuestionVariant, isVariantDifficulty, isVariantStatus, isQuestionVariantType, listQuestionVariants } from "@/services/question-variant-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const params = new URL(request.url).searchParams;
    const questionValue = params.get("questionId");
    const subjectValue = params.get("subjectId");
    const chapterValue = params.get("chapterId");
    const questionId = questionValue ? parseObjectId(questionValue) : null;
    const subjectId = subjectValue ? parseObjectId(subjectValue) : null;
    const chapterId = chapterValue ? parseObjectId(chapterValue) : null;
    if (questionValue && !questionId) return invalidRequest("The question ID is invalid.");
    if (subjectValue && !subjectId) return invalidRequest("The subject ID is invalid.");
    if (chapterValue && !chapterId) return invalidRequest("The chapter ID is invalid.");

    const variantType = params.get("variantType");
    const difficulty = params.get("difficulty");
    const status = params.get("status");
    if (variantType && !isQuestionVariantType(variantType)) return invalidRequest("Choose a valid variant type.");
    if (difficulty && !isVariantDifficulty(difficulty)) return invalidRequest("Choose a valid difficulty.");
    if (status && !isVariantStatus(status)) return invalidRequest("Choose a valid status.");

    const variants = await listQuestionVariants(user._id, {
      questionId: questionId ?? undefined,
      subjectId: subjectId ?? undefined,
      chapterId: chapterId ?? undefined,
      variantType: variantType as Parameters<typeof listQuestionVariants>[1]["variantType"] ?? undefined,
      difficulty: difficulty as Parameters<typeof listQuestionVariants>[1]["difficulty"] ?? undefined,
      status: status as Parameters<typeof listQuestionVariants>[1]["status"] ?? undefined,
      search: params.get("search")?.trim() || undefined,
    });
    return NextResponse.json({ variants });
  } catch (error) {
    return questionVariantFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = readJsonObject(await request.json().catch(() => null));
    if (!body) return invalidRequest("Send a valid variant form.");
    const parsed = parseQuestionVariantInput(body);
    if (parsed.error || !parsed.input) return invalidRequest(parsed.error ?? "Check the variant fields and try again.");
    const variant = await createQuestionVariant(user._id, parsed.input);
    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    return questionVariantFailure(error);
  }
}