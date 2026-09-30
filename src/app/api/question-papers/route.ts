import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { paperFailure, paperInvalid, paperManagerOnly, parseQuestionPaperInput, readPaperRequest } from "@/lib/question-paper-api";
import { parseObjectId } from "@/services/academic-service";
import { createQuestionPaper, listQuestionPapers } from "@/services/question-paper-service";
import type { QuestionPaperStatus } from "@/types/question-paper";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const subjectValue = params.get("subjectId");
    const chapterValue = params.get("chapterId");
    const subjectId = subjectValue ? parseObjectId(subjectValue) : undefined;
    const chapterId = chapterValue ? parseObjectId(chapterValue) : undefined;
    if (subjectValue && !subjectId) return paperInvalid("The subject ID is invalid.");
    if (chapterValue && !chapterId) return paperInvalid("The chapter ID is invalid.");
    const status = params.get("status");
    if (status && !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return paperInvalid("Choose a valid paper status.");
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "10");
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return paperInvalid("Pagination values are invalid.");
    const result = await listQuestionPapers(user._id, {
      subjectId: subjectId ?? undefined, chapterId: chapterId ?? undefined, className: params.get("className")?.trim() || undefined,
      status: status as QuestionPaperStatus | null ?? undefined, search: params.get("search")?.trim() || undefined,
      page, pageSize,
    });
    return NextResponse.json(result);
  } catch (error) {
    return paperFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const body = readPaperRequest(await request.json().catch(() => null));
    if (!body) return paperInvalid("Send a valid question paper form.");
    const parsed = parseQuestionPaperInput(body);
    if (!parsed.input) return paperInvalid(parsed.error ?? "Check the question paper fields and try again.");
    const result = await createQuestionPaper(user._id, parsed.input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return paperFailure(error);
  }
}