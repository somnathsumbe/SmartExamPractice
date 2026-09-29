import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-response";
import { assertSessionConfiguration, createSession } from "@/lib/session";
import { findUserForLogin, recordLogin } from "@/services/user-service";

export async function POST(request: Request) {
  try {
    assertSessionConfiguration();
    const body = await request.json();
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");
    if (!identifier || !password) {
      return NextResponse.json({ error: "Enter your username or email and password." }, { status: 400 });
    }

    const user = await findUserForLogin(identifier);
    if (!user || !user.passwordHash || !(await compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ error: "This account is inactive. Contact your school administrator." }, { status: 403 });
    }

    await recordLogin(user._id);
    await createSession(user._id.toString(), Boolean(body.rememberMe));
    return NextResponse.json({ ok: true });
  } catch {
    return serverError();
  }
}