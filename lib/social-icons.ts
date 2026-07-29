export const SOCIAL_ICONS = [
  { id: "website", label: "Website", glyph: "↗", color: "#ffffff" },
  { id: "youtube", label: "YouTube", glyph: "▶", color: "#ff0033" },
  { id: "discord", label: "Discord", glyph: "◖◗", color: "#5865f2" },
  { id: "facebook", label: "Facebook", glyph: "f", color: "#1877f2" },
  { id: "instagram", label: "Instagram", glyph: "◎", color: "#e4405f" },
  { id: "tiktok", label: "TikTok", glyph: "♪", color: "#25f4ee" },
  { id: "x", label: "X / Twitter", glyph: "𝕏", color: "#ffffff" },
  { id: "threads", label: "Threads", glyph: "@", color: "#ffffff" },
  { id: "github", label: "GitHub", glyph: "⌘", color: "#ffffff" },
  { id: "linkedin", label: "LinkedIn", glyph: "in", color: "#0a66c2" },
  { id: "twitch", label: "Twitch", glyph: "tv", color: "#9146ff" },
  { id: "kick", label: "Kick", glyph: "K", color: "#53fc18" },
  { id: "steam", label: "Steam", glyph: "◉", color: "#66c0f4" },
  { id: "spotify", label: "Spotify", glyph: "≋", color: "#1ed760" },
  { id: "soundcloud", label: "SoundCloud", glyph: "☁", color: "#ff5500" },
  { id: "apple-music", label: "Apple Music", glyph: "♫", color: "#fa243c" },
  { id: "telegram", label: "Telegram", glyph: "➤", color: "#26a5e4" },
  { id: "zalo", label: "Zalo", glyph: "Z", color: "#0068ff" },
  { id: "reddit", label: "Reddit", glyph: "●", color: "#ff4500" },
  { id: "pinterest", label: "Pinterest", glyph: "P", color: "#bd081c" },
  { id: "snapchat", label: "Snapchat", glyph: "♧", color: "#fffc00" },
  { id: "whatsapp", label: "WhatsApp", glyph: "☎", color: "#25d366" },
  { id: "messenger", label: "Messenger", glyph: "ϟ", color: "#00b2ff" },
  { id: "email", label: "Email", glyph: "@", color: "#ffffff" },
  { id: "patreon", label: "Patreon", glyph: "P", color: "#ff424d" },
  { id: "ko-fi", label: "Ko-fi", glyph: "☕", color: "#ff5e5b" },
  { id: "behance", label: "Behance", glyph: "Bē", color: "#1769ff" },
  { id: "dribbble", label: "Dribbble", glyph: "◉", color: "#ea4c89" },
  { id: "roblox", label: "Roblox", glyph: "◇", color: "#ffffff" },
  { id: "playstation", label: "PlayStation", glyph: "PS", color: "#0070d1" },
  { id: "xbox", label: "Xbox", glyph: "X", color: "#107c10" },
  { id: "epic-games", label: "Epic Games", glyph: "EG", color: "#ffffff" },
  { id: "itch-io", label: "itch.io", glyph: "IO", color: "#fa5c5c" },
  { id: "tumblr", label: "Tumblr", glyph: "t", color: "#35465c" },
  { id: "medium", label: "Medium", glyph: "M", color: "#ffffff" },
  { id: "deviantart", label: "DeviantArt", glyph: "DA", color: "#05cc47" },
  { id: "vimeo", label: "Vimeo", glyph: "v", color: "#1ab7ea" },
] as const;

export type SocialIconId = (typeof SOCIAL_ICONS)[number]["id"];

const SOCIAL_ICON_IDS = new Set<string>(
  SOCIAL_ICONS.map((icon) => icon.id),
);

export function isSocialIconId(value: unknown): value is SocialIconId {
  return typeof value === "string" && SOCIAL_ICON_IDS.has(value);
}

export function socialIcon(
  value: SocialIconId,
): (typeof SOCIAL_ICONS)[number] {
  return (
    SOCIAL_ICONS.find((icon) => icon.id === value) ?? SOCIAL_ICONS[0]
  );
}

export function inferSocialIcon(label: string, url: string): SocialIconId {
  const value = `${label} ${url}`.toLowerCase();
  const matches: Array<[SocialIconId, string[]]> = [
    ["youtube", ["youtube", "youtu.be"]],
    ["discord", ["discord", "discord.gg"]],
    ["facebook", ["facebook", "fb.com"]],
    ["instagram", ["instagram"]],
    ["tiktok", ["tiktok"]],
    ["threads", ["threads.net", "threads"]],
    ["github", ["github"]],
    ["linkedin", ["linkedin"]],
    ["twitch", ["twitch"]],
    ["kick", ["kick.com"]],
    ["steam", ["steamcommunity", "steampowered", "steam"]],
    ["spotify", ["spotify"]],
    ["soundcloud", ["soundcloud"]],
    ["apple-music", ["music.apple", "apple music"]],
    ["telegram", ["t.me", "telegram"]],
    ["zalo", ["zalo"]],
    ["reddit", ["reddit"]],
    ["pinterest", ["pinterest", "pin.it"]],
    ["snapchat", ["snapchat"]],
    ["whatsapp", ["wa.me", "whatsapp"]],
    ["messenger", ["m.me", "messenger"]],
    ["patreon", ["patreon"]],
    ["ko-fi", ["ko-fi"]],
    ["behance", ["behance"]],
    ["dribbble", ["dribbble"]],
    ["roblox", ["roblox"]],
    ["playstation", ["playstation", "psn"]],
    ["xbox", ["xbox"]],
    ["epic-games", ["epicgames", "epic games"]],
    ["itch-io", ["itch.io"]],
    ["tumblr", ["tumblr"]],
    ["medium", ["medium.com"]],
    ["deviantart", ["deviantart"]],
    ["vimeo", ["vimeo"]],
    ["email", ["mailto:", "email", "e-mail"]],
    ["x", ["x.com", "twitter"]],
  ];
  return (
    matches.find(([, tokens]) =>
      tokens.some((token) => value.includes(token)),
    )?.[0] ?? "website"
  );
}
