import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { assertSessionConfiguration, createSession } from "@/lib/session";
import { createUser } from "@/services/user-service";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9_.-]{3,32}$/;

export async function POST(request: Request) {
  try {
    assertSessionConfiguration();
    const body = await request.json();
    const userName = String(body.userName ?? "").trim().toLowerCase();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const mobile = String(body.mobile ?? "").trim();
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    const className = String(body.className ?? "").trim();

    if (!usernamePattern.test(userName)) {
      return NextResponse.json({ error: "Use 3-32 characters for the username: letters, numbers, dots, hyphens, or underscores." }, { status: 400 });
    }
    if (!firstName || firstName.length > 80 || !className || className.length > 80) {
      return NextResponse.json({ error: "First name and class are required." }, { status: 400 });
    }
    if (!emailPattern.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 10 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Use at least 10 characters, including uppercase, lowercase, and a number." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }
    if ([lastName, mobile, String(body.schoolName ?? ""), String(body.division ?? ""), String(body.board ?? "")].some((value) => value.length > 100)) {
      return NextResponse.json({ error: "Keep profile fields under 100 characters." }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const user = await createUser({
      userName,
      firstName,
      lastName,
      email,
      mobile,
      passwordHash,
      schoolName: String(body.schoolName ?? "").trim(),
      className,
      division: String(body.division ?? "").trim(),
      board: String(body.board ?? "").trim(),
    });

    await createSession(user._id.toString());
    return NextResponse.json({ user: { userName: user.userName, profile: user.profile } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      const duplicateField = "keyPattern" in error && typeof error.keyPattern === "object" && error.keyPattern !== null && "userName" in error.keyPattern
        ? "username"
        : "email";
      return NextResponse.json({ error: `An account with this ${duplicateField} already exists.` }, { status: 409 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
    }
    return NextResponse.json({ error: "The service is temporarily unavailable. Please try again." }, { status: 503 });
  }
}