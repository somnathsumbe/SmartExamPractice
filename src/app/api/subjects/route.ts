import { NextResponse } from "next/server";
import { academicFailure, integerField, invalidRequest, readRequestObject, statusField, stringField } from "@/lib/academic-api";
import { unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { createSubject, isAcademicStatus, listSubjects } from "@/services/academic-service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const params = new URL(request.url).searchParams;
    const statusValue = params.get("status");
    if (statusValue && !isAcademicStatus(statusValue)) return invalidRequest("Choose a valid subject status.");
    const subjects = await listSubjects(user._id, {
      className: params.get("className")?.trim() || undefined,
      status: statusValue as "active" | "inactive" | null ?? undefined,
      search: params.get("search")?.trim() || undefined,
    });
    return NextResponse.json({ subjects });
  } catch (error) {
    return academicFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const body = await readRequestObject(request);
    if (!body) return invalidRequest("Send a valid subject form.");

    const name = stringField(body, "name", 120, true);
    const className = stringField(body, "className", 80, true);
    const code = stringField(body, "code", 32);
    const description = stringField(body, "description", 1000);
    const status = statusField(body);
    const displayOrder = integerField(body, "displayOrder");
    if (name === null || className === null || code === null || description === null || status === null || displayOrder === null) {
      return invalidRequest("Enter a subject name and class, and check the optional fields.");
    }

    const subject = await createSubject(user._id, { name, className, code, description, status, displayOrder });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    return academicFailure(error);
  }
}