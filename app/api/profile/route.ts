import { getProfile } from "@/lib/profile";

export async function GET() {
  return Response.json(await getProfile(), {
    headers: { "Cache-Control": "no-store" },
  });
}
