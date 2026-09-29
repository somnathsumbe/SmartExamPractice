import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import AppLayout from "@/components/layout/AppLayout";
import SmartLoader from "@/components/common/SmartLoader";
import { getCurrentUser } from "@/lib/auth";
import { toPublicUser } from "@/services/user-service";

async function ProtectedApp({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppLayout user={toPublicUser(user)}>{children}</AppLayout>;
}

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="app-loading"><SmartLoader /></main>}><ProtectedApp>{children}</ProtectedApp></Suspense>;
}