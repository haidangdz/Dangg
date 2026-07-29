import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const authenticated = await verifyAdminSession(
    cookieStore.get(ADMIN_COOKIE_NAME)?.value,
  );
  if (!authenticated) redirect("/");

  const profile = await getProfile();

  return (
    <AdminPanel
      initialConfig={profile.config}
      views={profile.views}
    />
  );
}
