type LanyardActivity = {
  type?: number;
  name?: string;
  state?: string;
  details?: string;
  emoji?: {
    name?: string;
  };
};

type LanyardSpotify = {
  song?: string;
  artist?: string;
  album_art_url?: string;
} | null;

type LanyardResponse = {
  success?: boolean;
  data?: {
    discord_status?: string;
    active_on_discord_desktop?: boolean;
    active_on_discord_mobile?: boolean;
    active_on_discord_web?: boolean;
    discord_user?: {
      id?: string;
      username?: string;
      global_name?: string | null;
      discriminator?: string;
      avatar?: string | null;
      primary_guild?: {
        identity_guild_id?: string | null;
        identity_enabled?: boolean | null;
        tag?: string | null;
        badge?: string | null;
      } | null;
      collectibles?: {
        nameplate?: {
          asset?: string;
          palette?: string;
        } | null;
      } | null;
    };
    activities?: LanyardActivity[];
    spotify?: LanyardSpotify;
  };
};

const allowedStatuses = new Set(["online", "idle", "dnd", "offline"]);

function avatarUrl(
  userId: string,
  avatar: string | null | undefined,
  discriminator: string | undefined,
) {
  if (avatar) {
    const extension = avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=128`;
  }

  const fallbackIndex = Number(discriminator || "0") % 5;
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function primaryGuild(
  source: NonNullable<
    NonNullable<LanyardResponse["data"]>["discord_user"]
  >["primary_guild"],
) {
  if (
    !source?.identity_enabled ||
    !source.identity_guild_id ||
    !source.tag
  ) {
    return null;
  }

  return {
    tag: source.tag,
    badgeUrl: source.badge
      ? `https://cdn.discordapp.com/clan-badges/${source.identity_guild_id}/${source.badge}.png?size=64`
      : "",
  };
}

function activityText(
  activities: LanyardActivity[],
  spotify: LanyardSpotify | undefined,
) {
  if (spotify?.song) {
    return {
      type: "listening",
      label: `Listening to ${spotify.song}`,
      detail: spotify.artist || "",
      imageUrl: spotify.album_art_url || "",
    };
  }

  const activity = activities.find((item) => item.type !== 4);
  if (activity?.name) {
    const verbs: Record<number, string> = {
      0: "Playing",
      2: "Listening to",
      3: "Watching",
      5: "Competing in",
    };
    return {
      type: "activity",
      label: `${verbs[activity.type ?? 0] || "Using"} ${activity.name}`,
      detail: activity.details || activity.state || "",
      imageUrl: "",
    };
  }

  const custom = activities.find((item) => item.type === 4);
  return custom?.state
    ? {
        type: "custom",
        label: `${custom.emoji?.name ? `${custom.emoji.name} ` : ""}${custom.state}`,
        detail: "",
        imageUrl: "",
      }
    : null;
}

export async function GET(request: Request) {
  const userId =
    new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^\d{15,22}$/.test(userId)) {
    return Response.json(
      { success: false, error: "Discord User ID không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://api.lanyard.rest/v1/users/${encodeURIComponent(userId)}`,
      {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 10, cacheEverything: true },
      } as RequestInit,
    );

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error:
            response.status === 404
              ? "Discord này chưa kết nối Lanyard."
              : "Không đọc được trạng thái Discord.",
        },
        { status: response.status === 404 ? 404 : 502 },
      );
    }

    const payload = (await response.json()) as LanyardResponse;
    const source = payload.data;
    const user = source?.discord_user;
    if (!payload.success || !source || !user?.id || !user.username) {
      return Response.json(
        { success: false, error: "Discord này chưa kết nối Lanyard." },
        { status: 404 },
      );
    }

    const status = allowedStatuses.has(source.discord_status ?? "")
      ? source.discord_status
      : "offline";

    return Response.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.global_name || user.username,
          avatarUrl: avatarUrl(user.id, user.avatar, user.discriminator),
          status,
          activity: activityText(source.activities ?? [], source.spotify),
          primaryGuild: primaryGuild(user.primary_guild),
          nameplate: user.collectibles?.nameplate
            ? {
                asset: user.collectibles.nameplate.asset || "",
                palette: user.collectibles.nameplate.palette || "cobalt",
              }
            : null,
          platforms: {
            desktop: Boolean(source.active_on_discord_desktop),
            mobile: Boolean(source.active_on_discord_mobile),
            web: Boolean(source.active_on_discord_web),
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=10, stale-while-revalidate=20",
        },
      },
    );
  } catch {
    return Response.json(
      { success: false, error: "Dịch vụ Discord presence đang gián đoạn." },
      { status: 502 },
    );
  }
}
