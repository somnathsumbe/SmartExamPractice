import { NextResponse } from "next/server";
import { AcademicError } from "@/services/academic-service";
import { serverError } from "@/lib/api-response";

export function readJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function readRequestObject(request: Request) {
  try {
    return readJsonObject(await request.json());
  } catch {
    return null;
  }
}

export function stringField(body: Record<string, unknown>, field: string, maxLength = Number.MAX_SAFE_INTEGER, required = false) {
  const value = body[field];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") return null;
  const text = value.trim();
  if ((required && !text) || text.length > maxLength) return null;
  return text;
}

export function integerField(body: Record<string, unknown>, field: string, minimum = 0) {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) return null;
  return value;
}

export function statusField(body: Record<string, unknown>, fallback: "active" | "inactive" = "active") {
  const value = body.status;
  if (value === undefined) return fallback;
  return value === "active" || value === "inactive" ? value : null;
}

export function invalidRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function academicFailure(error: unknown) {
  if (error instanceof AcademicError) return NextResponse.json({ error: error.message }, { status: error.status });
  return serverError();
}