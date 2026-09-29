import { NextResponse } from "next/server";
import { serverError, unauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { toPublicUser } from "@/services/user-service";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return NextResponse.json({ user: toPublicUser(user) });
  } catch {
    return serverError();
  }
}