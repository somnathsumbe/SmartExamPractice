import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { paperFailure, paperInvalid, paperManagerOnly, parseQuestionPaperInput, readPaperRequest } from "@/lib/question-paper-api";
import { archiveQuestionPaper, getQuestionPaper, updateQuestionPaper } from "@/services/question-paper-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id } = await params;
    const paperId = parseObjectId(id);
    if (!paperId) return paperInvalid("The paper ID is invalid.");
    const paper = await getQuestionPaper(user._id, paperId);
    if (!paper) return NextResponse.json({ error: "Question paper not found." }, { status: 404 });
    return NextResponse.json({ paper });
  } catch (error) {
    return paperFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id } = await params;
    const paperId = parseObjectId(id);
    if (!paperId) return paperInvalid("The paper ID is invalid.");
    const body = readPaperRequest(await request.json().catch(() => null));
    if (!body) return paperInvalid("Send valid question paper updates.");
    const parsed = parseQuestionPaperInput(body);
    if (!parsed.input) return paperInvalid(parsed.error ?? "Check the question paper fields and try again.");
    const paper = await updateQuestionPaper(user._id, paperId, parsed.input);
    if (!paper) return NextResponse.json({ error: "Question paper not found." }, { status: 404 });
    return NextResponse.json({ paper });
  } catch (error) {
    return paperFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const denied = paperManagerOnly(user.role);
    if (denied) return denied;
    const { id } = await params;
    const paperId = parseObjectId(id);
    if (!paperId) return paperInvalid("The paper ID is invalid.");
    const paper = await archiveQuestionPaper(user._id, paperId);
    if (!paper) return NextResponse.json({ error: "Question paper not found." }, { status: 404 });
    return NextResponse.json({ paper });
  } catch (error) {
    return paperFailure(error);
  }
}