import ProfileForm from "@/components/profile/ProfileForm";
import PageHeader from "@/components/common/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { toPublicUser } from "@/services/user-service";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <div className="profile-page"><PageHeader eyebrow="YOUR ACCOUNT" title="Profile" description="Keep your learning details up to date." /><ProfileForm user={toPublicUser(user)} /></div>;
}