import {
  adminSessionCookie,
  createAdminSession,
  expiredRevealSessionCookie,
  isRevealRequest,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!(await isRevealRequest(request))) {
    return Response.json(
      { error: "Secret route chưa được mở." },
      { status: 403 },
    );
  }

  let payload: { password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await verifyAdminPassword(payload.password))) {
    return Response.json(
      { error: "Mật khẩu không đúng." },
      { status: 401 },
    );
  }

  try {
    const token = await createAdminSession();
    const headers = new Headers();
    headers.append("Set-Cookie", adminSessionCookie(token, request));
    headers.append("Set-Cookie", expiredRevealSessionCookie(request));
    return Response.json(
      { ok: true },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Customize chưa được cấu hình trên máy chủ." },
      { status: 503 },
    );
  }
}
