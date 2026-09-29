import { NextResponse } from "next/server";

export function serverError() {
  return NextResponse.json(
    { error: "The service is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
}