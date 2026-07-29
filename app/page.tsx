import { getProfile } from "@/lib/profile";
import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getProfile();
  return <ProfileClient initialProfile={profile} />;
}
