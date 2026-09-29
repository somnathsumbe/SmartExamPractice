import { redirect } from "next/navigation";
import AuthFrame from "@/components/auth/AuthFrame";
import RegisterForm from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthFrame eyebrow="GET STARTED" title="A new chapter starts here." description="Create an account for your family's learning journey." isRegister><RegisterForm /></AuthFrame>;
}