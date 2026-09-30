import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { learningFailure, learningInvalid, parseHardWordInput, readLearningRequest } from "@/lib/chapter-learning-api";
import { createHardWord, getChapterLearningScope, listHardWords } from "@/services/chapter-learning-service";
import { parseObjectId } from "@/services/academic-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const value = new URL(request.url).searchParams.get("chapterId");
    const chapterId = value ? parseObjectId(value) : null;
    if (!chapterId) return learningInvalid("A valid chapter ID is required.");
    const { subjectId } = await getChapterLearningScope(user._id, chapterId);
    const words = await listHardWords(user._id, subjectId, chapterId);
    return NextResponse.json({ words });
  } catch (error) {
    return learningFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = readLearningRequest(await request.json().catch(() => null));
    if (!body) return learningInvalid("Send a valid hard word form.");
    const parsed = parseHardWordInput(body);
    if (!parsed.input) return learningInvalid(parsed.error ?? "Check the hard word fields and try again.");
    const word = await createHardWord(user._id, parsed.input);
    return NextResponse.json({ word }, { status: 201 });
  } catch (error) {
    return learningFailure(error);
  }
}