import { NextResponse } from "next/server";
import { invalidRequest, parseQuestionInput, questionFailure, readJsonObject } from "@/lib/question-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { parseObjectId } from "@/services/academic-service";
import { deactivateQuestion, getQuestionDetails, updateQuestion } from "@/services/question-service";
import { getQuestionVariantSummaries } from "@/services/question-variant-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const questionId = parseObjectId(id);
    if (!questionId) return invalidRequest("The question ID is invalid.");
    const details = await getQuestionDetails(user._id, questionId);
    if (!details) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    const variants = await getQuestionVariantSummaries(user._id, questionId);
    return NextResponse.json({ ...details, variants, variantCount: variants.length });
  } catch (error) {
    return questionFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const questionId = parseObjectId(id);
    if (!questionId) return invalidRequest("The question ID is invalid.");
    const body = readJsonObject(await request.json().catch(() => null));
    if (!body) return invalidRequest("Send valid question updates.");
    const parsed = parseQuestionInput(body);
    if (parsed.error || !parsed.input) return invalidRequest(parsed.error ?? "Check the question fields and try again.");
    const details = await updateQuestion(user._id, questionId, parsed.input);
    if (!details) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    return NextResponse.json(details);
  } catch (error) {
    return questionFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const questionId = parseObjectId(id);
    if (!questionId) return invalidRequest("The question ID is invalid.");
    const question = await deactivateQuestion(user._id, questionId);
    if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });
    return NextResponse.json({ question });
  } catch (error) {
    return questionFailure(error);
  }
}