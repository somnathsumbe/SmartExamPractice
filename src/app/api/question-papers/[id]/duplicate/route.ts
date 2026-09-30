import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { paperFailure, paperInvalid, paperManagerOnly } from "@/lib/question-paper-api";
import { duplicateQuestionPaper } from "@/services/question-paper-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id } = await params;
    const paperId = parseObjectId(id);
    if (!paperId) return paperInvalid("The paper ID is invalid.");
    const paper = await duplicateQuestionPaper(user._id, paperId);
    if (!paper) return NextResponse.json({ error: "Question paper not found." }, { status: 404 });
    return NextResponse.json({ paper }, { status: 201 });
  } catch (error) {
    return paperFailure(error);
  }
}