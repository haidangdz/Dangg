import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireOwner, runtimeEnv } from "@/lib/profile";

const MAX_FILE_SIZE = 35 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "audio/", "video/"];

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    await requireOwner(user);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Owner access required." },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a file first." }, { status: 400 });
  }
  if (
    file.size <= 0 ||
    file.size > MAX_FILE_SIZE ||
    !ALLOWED_PREFIXES.some((prefix) => file.type.startsWith(prefix))
  ) {
    return Response.json(
      { error: "Use an image, audio or video file under 35 MB." },
      { status: 400 },
    );
  }

  const { MEDIA, DB } = runtimeEnv();
  if (!MEDIA || !DB) {
    return Response.json({ error: "Media storage is unavailable." }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const key = `${file.type.split("/")[0]}/${id}-${safeFileName(file.name)}`;
  await MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName: file.name.slice(0, 180),
      owner: user.email,
    },
  });
  await DB.prepare(
    `INSERT INTO media_assets
      (id, object_key, name, content_type, size)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, key, file.name.slice(0, 180), file.type, file.size)
    .run();

  return Response.json(
    { url: `/api/assets/${encodeURIComponent(key)}`, name: file.name },
    { status: 201 },
  );
}
