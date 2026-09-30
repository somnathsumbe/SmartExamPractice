import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { learningFailure, learningInvalid, parseChapterContentInput, readLearningRequest } from "@/lib/chapter-learning-api";
import { createChapterContent, getChapterLearningScope, listChapterContents } from "@/services/chapter-learning-service";
import { parseObjectId } from "@/services/academic-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const value = new URL(request.url).searchParams.get("chapterId");
    const chapterId = value ? parseObjectId(value) : null;
    if (!chapterId) return learningInvalid("A valid chapter ID is required.");
    const { subjectId } = await getChapterLearningScope(user._id, chapterId);
    const contents = await listChapterContents(user._id, subjectId, chapterId);
    return NextResponse.json({ contents });
  } catch (error) {
    return learningFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = readLearningRequest(await request.json().catch(() => null));
    if (!body) return learningInvalid("Send a valid chapter content form.");
    const parsed = parseChapterContentInput(body);
    if (!parsed.input) return learningInvalid(parsed.error ?? "Check the content fields and try again.");
    const content = await createChapterContent(user._id, parsed.input);
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return learningFailure(error);
  }
}