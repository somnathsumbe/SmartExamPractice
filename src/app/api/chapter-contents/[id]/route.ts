import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { learningFailure, learningInvalid, parseChapterContentInput, readLearningRequest } from "@/lib/chapter-learning-api";
import { deactivateChapterContent, getChapterContent, updateChapterContent } from "@/services/chapter-learning-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const contentId = parseObjectId(id);
    if (!contentId) return learningInvalid("The chapter content ID is invalid.");
    const content = await getChapterContent(user._id, contentId);
    if (!content) return NextResponse.json({ error: "Chapter content not found." }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    return learningFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const contentId = parseObjectId(id);
    if (!contentId) return learningInvalid("The chapter content ID is invalid.");
    const body = readLearningRequest(await request.json().catch(() => null));
    if (!body) return learningInvalid("Send valid chapter content updates.");
    const parsed = parseChapterContentInput(body);
    if (!parsed.input) return learningInvalid(parsed.error ?? "Check the content fields and try again.");
    const content = await updateChapterContent(user._id, contentId, parsed.input);
    if (!content) return NextResponse.json({ error: "Chapter content not found." }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    return learningFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const contentId = parseObjectId(id);
    if (!contentId) return learningInvalid("The chapter content ID is invalid.");
    const content = await deactivateChapterContent(user._id, contentId);
    if (!content) return NextResponse.json({ error: "Chapter content not found." }, { status: 404 });
    return NextResponse.json({ content });
  } catch (error) {
    return learningFailure(error);
  }
}