import { NextResponse } from "next/server";
import { academicFailure, integerField, invalidRequest, readRequestObject, statusField, stringField } from "@/lib/academic-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { deactivateChapter, getChapterDetails, parseObjectId, updateChapter } from "@/services/academic-service";
import { getChapterQuestionCounts } from "@/services/question-service";
import { getChapterVariantCount } from "@/services/question-variant-service";
import type { AcademicStatus } from "@/types/academics";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const chapterId = parseObjectId(id);
    if (!chapterId) return invalidRequest("The chapter ID is invalid.");
    const details = await getChapterDetails(user._id, chapterId);
    if (!details) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
    const [questionCounts, variantCount] = await Promise.all([
      getChapterQuestionCounts(user._id, chapterId),
      getChapterVariantCount(user._id, chapterId),
    ]);
    return NextResponse.json({ ...details, questionCounts, variantCount });
  } catch (error) {
    return academicFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const chapterId = parseObjectId(id);
    if (!chapterId) return invalidRequest("The chapter ID is invalid.");
    const body = await readRequestObject(request);
    if (!body) return invalidRequest("Send valid chapter updates.");

    const updates: {
      name?: string;
      chapterNumber?: number;
      description?: string;
      displayOrder?: number;
      className?: string;
      status?: AcademicStatus;
      subjectId?: import("mongodb").ObjectId;
    } = {};
    if ("name" in body) {
      const value = stringField(body, "name", 120, true);
      if (value === null) return invalidRequest("Chapter name is required and must be 120 characters or fewer.");
      updates.name = value;
    }
    if ("chapterNumber" in body) {
      const value = integerField(body, "chapterNumber", 1);
      if (value === null || value === undefined) return invalidRequest("Chapter number must be a positive whole number.");
      updates.chapterNumber = value;
    }
    if ("description" in body) {
      const value = stringField(body, "description");
      if (value === null) return invalidRequest("Description must be text.");
      updates.description = value;
    }
    if ("displayOrder" in body) {
      const value = integerField(body, "displayOrder");
      if (value === null || value === undefined) return invalidRequest("Display order must be a non-negative whole number.");
      updates.displayOrder = value;
    }
    if ("className" in body) {
      const value = stringField(body, "className", 80, true);
      if (value === null) return invalidRequest("Class is required and must be 80 characters or fewer.");
      updates.className = value;
    }
    if ("status" in body) {
      const value = statusField(body);
      if (value === null) return invalidRequest("Choose a valid chapter status.");
      updates.status = value;
    }
    if ("subjectId" in body) {
      const value = stringField(body, "subjectId", 24, true);
      const subjectId = value ? parseObjectId(value) : null;
      if (!subjectId) return invalidRequest("The subject ID is invalid.");
      updates.subjectId = subjectId;
    }
    if (!Object.keys(updates).length) return invalidRequest("Choose at least one chapter field to update.");

    const details = await updateChapter(user._id, chapterId, updates);
    if (!details) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
    return NextResponse.json(details);
  } catch (error) {
    return academicFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const chapterId = parseObjectId(id);
    if (!chapterId) return invalidRequest("The chapter ID is invalid.");
    const chapter = await deactivateChapter(user._id, chapterId);
    if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
    return NextResponse.json({ chapter });
  } catch (error) {
    return academicFailure(error);
  }
}