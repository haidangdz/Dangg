import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getProfile, requireOwner } from "@/lib/profile";
import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  await requireOwner(user);
  const profile = await getProfile();

  return (
    <AdminPanel
      initialConfig={profile.config}
      views={profile.views}
      userEmail={user.email}
    />
  );
}
