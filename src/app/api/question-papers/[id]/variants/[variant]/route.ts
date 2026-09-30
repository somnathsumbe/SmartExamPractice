import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { paperFailure, paperInvalid, paperManagerOnly } from "@/lib/question-paper-api";
import { getQuestionPaperVariant } from "@/services/question-paper-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string; variant: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id, variant } = await params;
    const paperId = parseObjectId(id);
    if (!paperId || !/^[A-Z]$/.test(variant)) return paperInvalid("The paper or variant ID is invalid.");
    const paperVariant = await getQuestionPaperVariant(user._id, paperId, variant);
    if (!paperVariant) return NextResponse.json({ error: "Paper variant not found." }, { status: 404 });
    return NextResponse.json({ variant: paperVariant });
  } catch (error) {
    return paperFailure(error);
  }
}