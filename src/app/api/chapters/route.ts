import { NextResponse } from "next/server";
import { academicFailure, integerField, invalidRequest, readRequestObject, statusField, stringField } from "@/lib/academic-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { createChapter, isAcademicStatus, listChapters, parseObjectId } from "@/services/academic-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const params = new URL(request.url).searchParams;
    const statusValue = params.get("status");
    if (statusValue && !isAcademicStatus(statusValue)) return invalidRequest("Choose a valid chapter status.");
    const subjectValue = params.get("subjectId");
    const subjectId = subjectValue ? parseObjectId(subjectValue) : undefined;
    if (subjectValue && !subjectId) return invalidRequest("The subject ID is invalid.");
    const chapters = await listChapters(user._id, {
      className: params.get("className")?.trim() || undefined,
      subjectId: subjectId ?? undefined,
      status: statusValue as "active" | "inactive" | null ?? undefined,
      search: params.get("search")?.trim() || undefined,
    });
    return NextResponse.json({ chapters });
  } catch (error) {
    return academicFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = await readRequestObject(request);
    if (!body) return invalidRequest("Send a valid chapter form.");

    const subjectValue = stringField(body, "subjectId", 24, true);
    const subjectId = subjectValue ? parseObjectId(subjectValue) : null;
    const name = stringField(body, "name", 120, true);
    const className = stringField(body, "className", 80, true);
    const description = stringField(body, "description", 1000);
    const chapterNumber = integerField(body, "chapterNumber", 1);
    const displayOrder = integerField(body, "displayOrder");
    const status = statusField(body);
    if (!subjectId || name === null || className === null || description === null || chapterNumber === null || displayOrder === null || status === null) {
      return invalidRequest("Select a subject, enter a chapter name and class, and check the optional fields.");
    }

    const chapter = await createChapter(user._id, { subjectId, name, className, description, chapterNumber, displayOrder, status });
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (error) {
    return academicFailure(error);
  }
}