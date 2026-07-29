import {
  expiredAdminSessionCookie,
  expiredRevealSessionCookie,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const headers = new Headers();
  headers.append("Set-Cookie", expiredAdminSessionCookie(request));
  headers.append("Set-Cookie", expiredRevealSessionCookie(request));
  return Response.json(
    { ok: true },
    { headers },
  );
}
