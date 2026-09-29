import { NextResponse } from "next/server";
import { academicFailure, integerField, invalidRequest, readRequestObject, statusField, stringField } from "@/lib/academic-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { deactivateSubject, getSubjectDetails, parseObjectId, updateSubject } from "@/services/academic-service";
import { getQuestionCountsByChapters } from "@/services/question-service";
import type { SubjectDocument } from "@/types/academics";

type RouteContext = { params: Promise<{ id: string }> };
type SubjectUpdates = Partial<Pick<SubjectDocument, "name" | "code" | "className" | "description" | "displayOrder" | "status">>;

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const subjectId = parseObjectId(id);
    if (!subjectId) return invalidRequest("The subject ID is invalid.");
    const details = await getSubjectDetails(user._id, subjectId);
    if (!details) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    const chapterIds = details.chapters.flatMap((chapter) => {
      const chapterId = parseObjectId(chapter._id);
      return chapterId ? [chapterId] : [];
    });
    const questionCounts = await getQuestionCountsByChapters(user._id, chapterIds);
    return NextResponse.json({
      ...details,
      chapters: details.chapters.map((chapter) => ({ ...chapter, questionCounts: questionCounts.get(chapter._id) ?? { total: 0, active: 0, inactive: 0 } })),
    });
  } catch (error) {
    return academicFailure(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const subjectId = parseObjectId(id);
    if (!subjectId) return invalidRequest("The subject ID is invalid.");
    const body = await readRequestObject(request);
    if (!body) return invalidRequest("Send valid subject updates.");

    const updates: SubjectUpdates = {};
    if ("name" in body) {
      const value = stringField(body, "name", 120, true);
      if (value === null) return invalidRequest("Subject name is required and must be 120 characters or fewer.");
      updates.name = value;
    }
    if ("code" in body) {
      const value = stringField(body, "code", 32);
      if (value === null) return invalidRequest("Subject code must be 32 characters or fewer.");
      updates.code = value;
    }
    if ("className" in body) {
      const value = stringField(body, "className", 80, true);
      if (value === null) return invalidRequest("Class is required and must be 80 characters or fewer.");
      updates.className = value;
    }
    if ("description" in body) {
      const value = stringField(body, "description", 1000);
      if (value === null) return invalidRequest("Description must be 1000 characters or fewer.");
      updates.description = value;
    }
    if ("displayOrder" in body) {
      const value = integerField(body, "displayOrder");
      if (value === null || value === undefined) return invalidRequest("Display order must be a non-negative whole number.");
      updates.displayOrder = value;
    }
    if ("status" in body) {
      const value = statusField(body);
      if (value === null) return invalidRequest("Choose a valid subject status.");
      updates.status = value;
    }
    if (!Object.keys(updates).length) return invalidRequest("Choose at least one subject field to update.");

    const subject = await updateSubject(user._id, subjectId, updates);
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    return NextResponse.json({ subject });
  } catch (error) {
    return academicFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await params;
    const subjectId = parseObjectId(id);
    if (!subjectId) return invalidRequest("The subject ID is invalid.");
    const subject = await deactivateSubject(user._id, subjectId);
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    return NextResponse.json({ subject });
  } catch (error) {
    return academicFailure(error);
  }
}