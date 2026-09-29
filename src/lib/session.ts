import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const cookieName = "smart-exam-session";
const defaultSessionSeconds = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Session signing is not configured");
  }
  return new TextEncoder().encode(secret);
}

export function assertSessionConfiguration() {
  secretKey();
}

export async function createSession(userId: string, rememberMe = false) {
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : defaultSessionSeconds;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function getSessionUserId() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(cookieName);
}