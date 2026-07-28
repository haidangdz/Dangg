import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getProfile, requireOwner, saveProfile } from "@/lib/profile";

async function authorize() {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      error: Response.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  try {
    await requireOwner(user);
    return { user };
  } catch (error) {
    return {
      error: Response.json(
        {
          error:
            error instanceof Error ? error.message : "Owner access required.",
        },
        { status: 403 },
      ),
    };
  }
}

export async function GET() {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  return Response.json({ ...(await getProfile()), user: auth.user });
}

export async function PUT(request: Request) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;

  try {
    const config = await saveProfile(await request.json());
    return Response.json({ config });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save." },
      { status: 400 },
    );
  }
}
