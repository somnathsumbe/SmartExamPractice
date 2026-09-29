import { getSessionUserId } from "@/lib/session";
import { findActiveUserById } from "@/services/user-service";

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return findActiveUserById(userId);
}