import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { learningFailure, learningInvalid, parseHardWordInput, readLearningRequest } from "@/lib/chapter-learning-api";
import { deactivateHardWord, getHardWord, updateHardWord } from "@/services/chapter-learning-service";
import { parseObjectId } from "@/services/academic-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const wordId = parseObjectId(id);
    if (!wordId) return learningInvalid("The hard word ID is invalid.");
    const word = await getHardWord(user._id, wordId);
    if (!word) return NextResponse.json({ error: "Hard word not found." }, { status: 404 });
    return NextResponse.json({ word });
  } catch (error) {
    return learningFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const wordId = parseObjectId(id);
    if (!wordId) return learningInvalid("The hard word ID is invalid.");
    const body = readLearningRequest(await request.json().catch(() => null));
    if (!body) return learningInvalid("Send valid hard word updates.");
    const parsed = parseHardWordInput(body);
    if (!parsed.input) return learningInvalid(parsed.error ?? "Check the hard word fields and try again.");
    const word = await updateHardWord(user._id, wordId, parsed.input);
    if (!word) return NextResponse.json({ error: "Hard word not found." }, { status: 404 });
    return NextResponse.json({ word });
  } catch (error) {
    return learningFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const wordId = parseObjectId(id);
    if (!wordId) return learningInvalid("The hard word ID is invalid.");
    const word = await deactivateHardWord(user._id, wordId);
    if (!word) return NextResponse.json({ error: "Hard word not found." }, { status: 404 });
    return NextResponse.json({ word });
  } catch (error) {
    return learningFailure(error);
  }
}