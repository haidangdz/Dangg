import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import {
  inferSocialIcon,
  isSocialIconId,
  type SocialIconId,
} from "@/lib/social-icons";

export type ProfileLink = {
  id: string;
  icon: SocialIconId;
  label: string;
  url: string;
  subtitle: string;
  visible: boolean;
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  url: string;
  lyrics: string;
  lrcUrl: string;
};

export type AvatarFrame =
  | "glitch"
  | "halo"
  | "frost"
  | "eclipse"
  | "ember";

export type DiscordBadgeId = "legacy" | "quest" | "nitro";

export type ProfileConfig = {
  displayName: string;
  handle: string;
  bio: string;
  bioMessages: string[];
  location: string;
  status: string;
  avatarUrl: string;
  avatarFrame: AvatarFrame;
  backgroundType: "gradient" | "image" | "video";
  backgroundUrl: string;
  accentColor: string;
  cardOpacity: number;
  blur: number;
  showViews: boolean;
  musicEnabled: boolean;
  discordPresenceEnabled: boolean;
  discordUserId: string;
  discordProfileUrl: string;
  discordBadgeIds: DiscordBadgeId[];
  links: ProfileLink[];
  tracks: MusicTrack[];
};

export const defaultProfile: ProfileConfig = {
  displayName: "Hải Đăng",
  handle: "@haidang",
  bio: "Trying to better my self",
  bioMessages: [
    "I love You",
    "Family, Money, Car, Game, Music, Immersed in a dream world",
    "Trying to better my self",
  ],
  location: "Da Nang, Vietnam",
  status: "online",
  avatarUrl: "/avatar/haidang-night.png",
  avatarFrame: "glitch",
  backgroundType: "video",
  backgroundUrl: "/media/background.mp4",
  accentColor: "#a78bfa",
  cardOpacity: 0.56,
  blur: 24,
  showViews: true,
  musicEnabled: true,
  discordPresenceEnabled: false,
  discordUserId: "",
  discordProfileUrl: "",
  discordBadgeIds: ["legacy", "quest", "nitro"],
  links: [
    {
      id: "facebook",
      icon: "facebook",
      label: "Facebook",
      subtitle: "Follow my daily life",
      url: "https://www.facebook.com/haridangw",
      visible: true,
    },
    {
      id: "instagram",
      icon: "instagram",
      label: "Instagram",
      subtitle: "Photos & moments",
      url: "https://www.instagram.com/_.haridawng",
      visible: true,
    },
    {
      id: "tiktok",
      icon: "tiktok",
      label: "TikTok",
      subtitle: "Short-form chaos",
      url: "https://www.tiktok.com/@_haridawng",
      visible: true,
    },
  ],
  tracks: [
    {
      id: "ha-noi",
      title: "Hà Nội",
      artist: "Obito, Shiki & VSTRA",
      url: "/music/ha-noi.mp3",
      lyrics: "",
      lrcUrl: "/music/ha-noi.lrc",
    },
    {
      id: "anh-sao-va-bau-troi",
      title: "Ánh Sao Và Bầu Trời",
      artist: "T.R.I",
      url: "/music/anh-sao-va-bau-troi.mp3",
      lyrics: "",
      lrcUrl: "/music/anh-sao-va-bau-troi.lrc",
    },
    {
      id: "neu-ngay-ay",
      title: "Nếu Ngày Ấy",
      artist: "SOOBIN",
      url: "/music/neu-ngay-ay.mp3",
      lyrics: "",
      lrcUrl: "/music/neu-ngay-ay.lrc",
    },
  ],
};

type RuntimeEnv = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
};

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

async function ensureDatabaseSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS profile_config (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS profile_stats (
      profile_id TEXT PRIMARY KEY NOT NULL,
      views INTEGER DEFAULT 0 NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS site_owner (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
  ]);
}

function normalizeConfig(input: unknown): ProfileConfig {
  const value =
    input && typeof input === "object"
      ? (input as Partial<ProfileConfig>)
      : {};

  return {
    ...defaultProfile,
    ...value,
    displayName: cleanText(value.displayName, defaultProfile.displayName, 80),
    handle: cleanText(value.handle, defaultProfile.handle, 40),
    bio: cleanText(value.bio, defaultProfile.bio, 240),
    bioMessages: normalizeBioMessages(value.bioMessages, value.bio),
    location: cleanText(value.location, defaultProfile.location, 80),
    status: cleanText(value.status, defaultProfile.status, 40),
    avatarUrl: cleanUrl(value.avatarUrl),
    avatarFrame: ["glitch", "halo", "frost", "eclipse", "ember"].includes(
      value.avatarFrame ?? "",
    )
      ? (value.avatarFrame as AvatarFrame)
      : defaultProfile.avatarFrame,
    backgroundUrl: cleanUrl(value.backgroundUrl),
    backgroundType: ["gradient", "image", "video"].includes(
      value.backgroundType ?? "",
    )
      ? (value.backgroundType as ProfileConfig["backgroundType"])
      : "gradient",
    accentColor: /^#[0-9a-f]{6}$/i.test(value.accentColor ?? "")
      ? (value.accentColor as string)
      : defaultProfile.accentColor,
    cardOpacity: clampNumber(value.cardOpacity, 0.25, 0.9, 0.56),
    blur: clampNumber(value.blur, 8, 42, 24),
    showViews: value.showViews !== false,
    musicEnabled: value.musicEnabled !== false,
    discordPresenceEnabled: value.discordPresenceEnabled === true,
    discordUserId: cleanDiscordUserId(value.discordUserId),
    discordProfileUrl: cleanUrl(value.discordProfileUrl),
    discordBadgeIds: normalizeDiscordBadgeIds(value.discordBadgeIds),
    links: Array.isArray(value.links)
      ? value.links.slice(0, 24).map(normalizeLink)
      : defaultProfile.links,
    tracks: Array.isArray(value.tracks)
      ? value.tracks.slice(0, 12).map(normalizeTrack).filter((track) => track.url)
      : defaultProfile.tracks,
  };
}

function normalizeDiscordBadgeIds(value: unknown): DiscordBadgeId[] {
  const allowed = new Set<DiscordBadgeId>(["legacy", "quest", "nitro"]);
  if (!Array.isArray(value)) return defaultProfile.discordBadgeIds;
  return [
    ...new Set(
      value.filter(
        (item): item is DiscordBadgeId =>
          typeof item === "string" && allowed.has(item as DiscordBadgeId),
      ),
    ),
  ].slice(0, 3);
}

function normalizeBioMessages(
  value: unknown,
  legacyBio: unknown,
): string[] {
  if (Array.isArray(value)) {
    const messages = value
      .slice(0, 8)
      .map((item) => cleanText(item, "", 180))
      .filter(Boolean);
    if (messages.length) return messages;
  }
  if (typeof legacyBio === "string" && legacyBio.trim()) {
    return [legacyBio.trim().slice(0, 180)];
  }
  return defaultProfile.bioMessages;
}

function normalizeLink(value: Partial<ProfileLink>, index: number): ProfileLink {
  const label = cleanText(value.label, `Link ${index + 1}`, 50);
  const url = cleanUrl(value.url);
  return {
    id: cleanText(value.id, crypto.randomUUID(), 80),
    icon: isSocialIconId(value.icon)
      ? value.icon
      : inferSocialIcon(label, url),
    label,
    subtitle: cleanText(value.subtitle, "", 80),
    url,
    visible: value.visible !== false,
  };
}

function normalizeTrack(value: Partial<MusicTrack>, index: number): MusicTrack {
  return {
    id: cleanText(value.id, crypto.randomUUID(), 80),
    title: cleanText(value.title, `Track ${index + 1}`, 80),
    artist: cleanText(value.artist, "Unknown artist", 80),
    url: cleanUrl(value.url),
    lyrics:
      typeof value.lyrics === "string" &&
      value.lyrics.trim() !== "No lyrics added yet"
        ? value.lyrics.trim().slice(0, 12000)
        : "",
    lrcUrl: cleanUrl(value.lrcUrl),
  };
}

function cleanText(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength) || fallback;
}

function cleanUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const url = value.trim().slice(0, 1600);
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol)
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function cleanDiscordUserId(value: unknown): string {
  if (typeof value !== "string") return "";
  const id = value.trim();
  return /^\d{15,22}$/.test(id) ? id : "";
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export async function getProfile(): Promise<{
  config: ProfileConfig;
  views: number;
}> {
  const db = runtimeEnv().DB;
  if (!db) return { config: defaultProfile, views: 0 };
  await ensureDatabaseSchema(db);

  const [configRow, statsRow] = await db.batch([
    db.prepare("SELECT data FROM profile_config WHERE id = ?").bind("main"),
    db
      .prepare("SELECT views FROM profile_stats WHERE profile_id = ?")
      .bind("main"),
  ]);

  let config = defaultProfile;
  const raw = configRow.results?.[0] as { data?: string } | undefined;
  if (raw?.data) {
    try {
      config = normalizeConfig(JSON.parse(raw.data));
    } catch {
      config = defaultProfile;
    }
  }

  const stats = statsRow.results?.[0] as { views?: number } | undefined;
  return { config, views: Number(stats?.views ?? 0) };
}

export async function saveProfile(input: unknown): Promise<ProfileConfig> {
  const db = runtimeEnv().DB;
  if (!db) throw new Error("Database is unavailable.");
  await ensureDatabaseSchema(db);
  const config = normalizeConfig(input);
  await db
    .prepare(
      `INSERT INTO profile_config (id, data, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         data = excluded.data,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind("main", JSON.stringify(config))
    .run();
  return config;
}

export async function requireOwner(user: ChatGPTUser): Promise<void> {
  const db = runtimeEnv().DB;
  if (!db) throw new Error("Database is unavailable.");
  await ensureDatabaseSchema(db);

  await db
    .prepare(
      `INSERT INTO site_owner (id, email)
       SELECT 1, ?
       WHERE NOT EXISTS (SELECT 1 FROM site_owner WHERE id = 1)`,
    )
    .bind(user.email.toLowerCase())
    .run();

  const owner = await db
    .prepare("SELECT email FROM site_owner WHERE id = 1")
    .first<{ email: string }>();
  if (!owner || owner.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("This account is not the site owner.");
  }
}

export async function incrementViews(): Promise<number> {
  const db = runtimeEnv().DB;
  if (!db) return 0;
  await ensureDatabaseSchema(db);

  await db
    .prepare(
      `INSERT INTO profile_stats (profile_id, views, updated_at)
       VALUES (?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(profile_id) DO UPDATE SET
         views = views + 1,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind("main")
    .run();

  const row = await db
    .prepare("SELECT views FROM profile_stats WHERE profile_id = ?")
    .bind("main")
    .first<{ views: number }>();
  return Number(row?.views ?? 0);
}
