import { NextResponse } from "next/server";
import { serverError, unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { toPublicUser, updateProfile } from "@/services/user-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return NextResponse.json({ user: toPublicUser(user) });
  } catch {
    return serverError();
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return unauthorized();

    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const mobile = String(body.mobile ?? "").trim();
    const schoolName = String(body.schoolName ?? "").trim();
    const className = String(body.className ?? "").trim();
    const division = String(body.division ?? "").trim();
    const board = String(body.board ?? "").trim();

    if (!firstName || !className || [firstName, lastName, mobile, schoolName, className, division, board].some((value) => value.length > 100)) {
      return NextResponse.json({ error: "Enter a first name and class, and keep each field under 100 characters." }, { status: 400 });
    }

    const user = await updateProfile(currentUser._id.toString(), {
      firstName,
      lastName,
      displayName: [firstName, lastName].filter(Boolean).join(" "),
      schoolName,
      className,
      division,
      board,
      mobile,
    });
    if (!user) return unauthorized();
    return NextResponse.json({ user: toPublicUser(user) });
  } catch {
    return serverError();
  }
}