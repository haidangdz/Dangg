import {
  createRevealSession,
  revealSessionCookie,
  verifyRevealPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  let payload: { password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await verifyRevealPassword(payload.password))) {
    return Response.json({ error: "Mã bí mật không đúng." }, { status: 401 });
  }

  try {
    const token = await createRevealSession();
    return Response.json(
      { ok: true },
      { headers: { "Set-Cookie": revealSessionCookie(token, request) } },
    );
  } catch {
    return Response.json(
      { error: "Secret route chưa được cấu hình." },
      { status: 503 },
    );
  }
}
