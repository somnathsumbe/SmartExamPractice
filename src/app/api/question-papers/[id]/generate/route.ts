import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { paperFailure, paperInvalid, paperManagerOnly, readPaperRequest } from "@/lib/question-paper-api";
import { generateQuestionPaper } from "@/services/question-paper-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id } = await params;
    const paperId = parseObjectId(id);
    if (!paperId) return paperInvalid("The paper ID is invalid.");
    const body = readPaperRequest(await request.json().catch(() => ({}))) ?? {};
    if (body.useAvailableQuestions !== undefined && typeof body.useAvailableQuestions !== "boolean") return paperInvalid("Choose an explicit available-question fallback setting.");
    const result = await generateQuestionPaper(user._id, paperId, body.useAvailableQuestions === true);
    if (!result) return NextResponse.json({ error: "Question paper not found." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return paperFailure(error);
  }
}