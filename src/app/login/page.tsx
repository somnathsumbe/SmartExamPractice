import { redirect } from "next/navigation";
import AuthFrame from "@/components/auth/AuthFrame";
import LoginForm from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthFrame eyebrow="WELCOME BACK" title="Let's pick up where you left off." description="Sign in to your learning space and keep your momentum going."><LoginForm /></AuthFrame>;
}