import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { paperFailure, paperInvalid, paperManagerOnly } from "@/lib/question-paper-api";
import { getQuestionPaperAnswerKey } from "@/services/question-paper-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id } = await params;
    const paperId = parseObjectId(id);
    if (!paperId) return paperInvalid("The paper ID is invalid.");
    const variant = new URL(request.url).searchParams.get("variant") ?? undefined;
    if (variant && !/^[A-Z]$/.test(variant)) return paperInvalid("The paper variant is invalid.");
    const answerKey = await getQuestionPaperAnswerKey(user._id, paperId, variant);
    if (!answerKey) return NextResponse.json({ error: "Question paper or variant not found." }, { status: 404 });
    return NextResponse.json({ answerKey });
  } catch (error) {
    return paperFailure(error);
  }
}