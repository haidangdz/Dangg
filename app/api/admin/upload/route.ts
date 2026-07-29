import { isAdminRequest } from "@/lib/admin-auth";
import { runtimeEnv } from "@/lib/profile";

const MAX_FILE_SIZE = 95 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "audio/", "video/"];

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a file first." }, { status: 400 });
  }
  const isLrc = file.name.toLowerCase().endsWith(".lrc");
  if (
    file.size <= 0 ||
    file.size > MAX_FILE_SIZE ||
    (!isLrc &&
      !ALLOWED_PREFIXES.some((prefix) => file.type.startsWith(prefix)))
  ) {
    return Response.json(
      { error: "Dùng file ảnh, âm thanh, video hoặc LRC dưới 95 MB." },
      { status: 400 },
    );
  }

  const { MEDIA, DB } = runtimeEnv();
  if (!MEDIA || !DB) {
    return Response.json({ error: "Media storage is unavailable." }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const assetType = isLrc ? "lyrics" : file.type.split("/")[0];
  const contentType = isLrc ? "text/plain; charset=utf-8" : file.type;
  const key = `${assetType}/${id}-${safeFileName(file.name)}`;
  await MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName: file.name.slice(0, 180),
      owner: "profile-admin",
    },
  });
  await DB.prepare(
    `INSERT INTO media_assets
      (id, object_key, name, content_type, size)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, key, file.name.slice(0, 180), contentType, file.size)
    .run();

  return Response.json(
    { url: `/api/assets/${encodeURIComponent(key)}`, name: file.name },
    { status: 201 },
  );
}
