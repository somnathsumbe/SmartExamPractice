import { NextResponse } from "next/server";
import { questionVariantFailure, invalidRequest, parseQuestionVariantInput, readJsonObject } from "@/lib/question-variant-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { parseObjectId } from "@/services/academic-service";
import { deactivateQuestionVariant, getQuestionVariantDetails, updateQuestionVariant } from "@/services/question-variant-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const variantId = parseObjectId(id);
    if (!variantId) return invalidRequest("The variant ID is invalid.");
    const details = await getQuestionVariantDetails(user._id, variantId);
    if (!details) return NextResponse.json({ error: "Question variant not found." }, { status: 404 });
    return NextResponse.json(details);
  } catch (error) {
    return questionVariantFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const variantId = parseObjectId(id);
    if (!variantId) return invalidRequest("The variant ID is invalid.");
    const body = readJsonObject(await request.json().catch(() => null));
    if (!body) return invalidRequest("Send valid variant updates.");
    const parsed = parseQuestionVariantInput(body);
    if (parsed.error || !parsed.input) return invalidRequest(parsed.error ?? "Check the variant fields and try again.");
    const details = await updateQuestionVariant(user._id, variantId, parsed.input);
    if (!details) return NextResponse.json({ error: "Question variant not found." }, { status: 404 });
    return NextResponse.json(details);
  } catch (error) {
    return questionVariantFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const variantId = parseObjectId(id);
    if (!variantId) return invalidRequest("The variant ID is invalid.");
    const variant = await deactivateQuestionVariant(user._id, variantId);
    if (!variant) return NextResponse.json({ error: "Question variant not found." }, { status: 404 });
    return NextResponse.json({ variant });
  } catch (error) {
    return questionVariantFailure(error);
  }
}