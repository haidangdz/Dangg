import { isAdminRequest } from "@/lib/admin-auth";
import { getProfile, saveProfile } from "@/lib/profile";

async function authorize(request: Request) {
  return isAdminRequest(request);
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json(await getProfile());
}

export async function PUT(request: Request) {
  if (!(await authorize(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

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
