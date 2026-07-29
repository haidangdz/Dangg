import { incrementViews } from "@/lib/profile";

const VIEW_COOKIE = "hd_profile_viewed";

export async function POST(request: Request) {
  const seen = request.headers
    .get("cookie")
    ?.split(";")
    .some((part) => part.trim().startsWith(`${VIEW_COOKIE}=`));

  let views = 0;
  if (seen) {
    const { getProfile } = await import("@/lib/profile");
    views = (await getProfile()).views;
  } else {
    views = await incrementViews();
  }

  return Response.json(
    { views },
    {
      headers: seen
        ? undefined
        : {
            "Set-Cookie": `${VIEW_COOKIE}=1; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax; Secure`,
          },
    },
  );
}
