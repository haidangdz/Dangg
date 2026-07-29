"use client";

import { useEffect, useState } from "react";
import { FaDiscord, FaGem, FaHashtag } from "react-icons/fa";
import { GiLaurelCrown } from "react-icons/gi";
import type { DiscordBadgeId } from "@/lib/profile";

type Presence = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  status: "online" | "idle" | "dnd" | "offline";
  activity: null | {
    type: string;
    label: string;
    detail: string;
    imageUrl: string;
  };
  primaryGuild: null | {
    tag: string;
    badgeUrl: string;
  };
  nameplate: null | {
    asset: string;
    palette: string;
  };
  platforms: {
    desktop: boolean;
    mobile: boolean;
    web: boolean;
  };
};

type PresenceResponse =
  | { success: true; user: Presence }
  | { success: false; error: string };

type LanyardActivity = {
  type?: number;
  name?: string;
  state?: string;
  details?: string;
  emoji?: {
    name?: string;
  };
};

type LanyardPresence = {
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
  spotify?: {
    song?: string;
    artist?: string;
    album_art_url?: string;
  } | null;
};

type LanyardSocketMessage = {
  op?: number;
  t?: string;
  d?: LanyardPresence | {
    heartbeat_interval?: number;
  };
};

const statusLabels: Record<Presence["status"], string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
};

function makeAvatarUrl(source: LanyardPresence["discord_user"]) {
  if (!source?.id) return "";
  if (source.avatar) {
    const extension = source.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${source.id}/${source.avatar}.${extension}?size=128`;
  }
  const fallbackIndex = Number(source.discriminator || "0") % 5;
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function makeActivity(source: LanyardPresence): Presence["activity"] {
  if (source.spotify?.song) {
    return {
      type: "listening",
      label: `Listening to ${source.spotify.song}`,
      detail: source.spotify.artist || "",
      imageUrl: source.spotify.album_art_url || "",
    };
  }

  const activity = source.activities?.find((item) => item.type !== 4);
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

  const custom = source.activities?.find((item) => item.type === 4);
  return custom?.state
    ? {
        type: "custom",
        label: `${custom.emoji?.name ? `${custom.emoji.name} ` : ""}${custom.state}`,
        detail: "",
        imageUrl: "",
      }
    : null;
}

function makePrimaryGuild(
  source: LanyardPresence["discord_user"],
): Presence["primaryGuild"] {
  const guild = source?.primary_guild;
  if (!guild?.identity_enabled || !guild.identity_guild_id || !guild.tag) {
    return null;
  }

  return {
    tag: guild.tag,
    badgeUrl: guild.badge
      ? `https://cdn.discordapp.com/clan-badges/${guild.identity_guild_id}/${guild.badge}.png?size=64`
      : "",
  };
}

function normalizePresence(source: LanyardPresence): Presence | null {
  const user = source.discord_user;
  if (!user?.id || !user.username) return null;
  const allowedStatuses: Presence["status"][] = [
    "online",
    "idle",
    "dnd",
    "offline",
  ];
  const status = allowedStatuses.includes(
    source.discord_status as Presence["status"],
  )
    ? (source.discord_status as Presence["status"])
    : "offline";

  return {
    id: user.id,
    username: user.username,
    displayName: user.global_name || user.username,
    avatarUrl: makeAvatarUrl(user),
    status,
    activity: makeActivity(source),
    primaryGuild: makePrimaryGuild(user),
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
  };
}

type Props = {
  userId: string;
  profileUrl?: string;
  preview?: boolean;
  badges?: DiscordBadgeId[];
};

const badgeLabels: Record<DiscordBadgeId, string> = {
  legacy: "Originally known as",
  quest: "Completed a Discord Quest",
  nitro: "Nitro subscriber",
};

function DiscordBadges({ badges }: { badges: DiscordBadgeId[] }) {
  if (!badges.length) return null;
  return (
    <span className="hd-discord-badges" aria-label="Discord profile badges">
      {badges.map((badge) => (
        <span
          className={`is-${badge}`}
          key={badge}
          title={badgeLabels[badge]}
          aria-label={badgeLabels[badge]}
        >
          {badge === "legacy" ? (
            <FaHashtag aria-hidden="true" />
          ) : badge === "quest" ? (
            <GiLaurelCrown aria-hidden="true" />
          ) : (
            <FaGem aria-hidden="true" />
          )}
        </span>
      ))}
    </span>
  );
}

export function DiscordPresenceCard({
  userId,
  profileUrl = "",
  preview = false,
  badges = [],
}: Props) {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [error, setError] = useState("");
  const validUserId = /^\d{15,22}$/.test(userId);

  useEffect(() => {
    if (!validUserId) {
      setPresence(null);
      setError(userId ? "Discord User ID chưa đúng." : "");
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let heartbeatTimer: number | null = null;
    let reconnectTimer: number | null = null;
    const controller = new AbortController();

    const applyPresence = (next: Presence | null) => {
      if (!active || !next) return;
      setPresence(next);
      setError("");
    };

    const loadFallback = async () => {
      try {
        const response = await fetch(
          `/api/discord-presence?id=${encodeURIComponent(userId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as PresenceResponse;
        if (!active) return;
        if (!response.ok || !payload.success) {
          if (!presence) {
            setError(
              payload.success
                ? "Không đọc được Discord."
                : payload.error || "Không đọc được Discord.",
            );
          }
          return;
        }
        applyPresence(payload.user);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        if (active && !presence) {
          setError("Presence tạm thời không phản hồi.");
        }
      }
    };

    const connectSocket = () => {
      if (!active || typeof WebSocket === "undefined") return;
      socket = new WebSocket("wss://api.lanyard.rest/socket");

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as LanyardSocketMessage;
          if (message.op === 1) {
            const hello = message.d as { heartbeat_interval?: number };
            const interval = Number(hello?.heartbeat_interval) || 30_000;
            if (heartbeatTimer) window.clearInterval(heartbeatTimer);
            heartbeatTimer = window.setInterval(() => {
              if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ op: 3 }));
              }
            }, interval);
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  op: 2,
                  d: { subscribe_to_id: userId },
                }),
              );
            }
            return;
          }

          if (
            message.op === 0 &&
            (message.t === "INIT_STATE" ||
              message.t === "PRESENCE_UPDATE")
          ) {
            applyPresence(normalizePresence(message.d as LanyardPresence));
          }
        } catch {
          // Ignore malformed socket frames and keep the REST fallback active.
        }
      });

      socket.addEventListener("close", () => {
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (active) {
          reconnectTimer = window.setTimeout(connectSocket, 5_000);
        }
      });
    };

    void loadFallback();
    connectSocket();
    const fallbackRefresh = window.setInterval(loadFallback, 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(fallbackRefresh);
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [userId, validUserId]);

  const href =
    profileUrl || (validUserId ? `https://discord.com/users/${userId}` : "");
  const content = presence ? (
    <>
      <span className="hd-discord-avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={presence.avatarUrl} alt="" />
        <i className={`is-${presence.status}`} aria-hidden="true" />
      </span>
      <span className="hd-discord-copy">
        <span className="hd-discord-name">
          <strong>{presence.displayName}</strong>
          <FaDiscord aria-hidden="true" />
        </span>
        <span className="hd-discord-identity">
          <small>@{presence.username}</small>
          {presence.primaryGuild ? (
            <span
              className="hd-discord-guild"
              title={`Server tag: ${presence.primaryGuild.tag}`}
            >
              <span className="hd-discord-guild-icon" aria-hidden="true">
                {presence.primaryGuild.badgeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={presence.primaryGuild.badgeUrl}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ) : null}
              </span>
              {presence.primaryGuild.tag}
            </span>
          ) : null}
          <DiscordBadges badges={badges} />
        </span>
        <span className="hd-discord-activity">
          {presence.activity?.label || statusLabels[presence.status]}
        </span>
      </span>
      <span className="hd-discord-status">
        <i className={`is-${presence.status}`} aria-hidden="true" />
        {statusLabels[presence.status]}
      </span>
    </>
  ) : (
    <>
      <span className="hd-discord-placeholder-icon">
        <FaDiscord aria-hidden="true" />
      </span>
      <span className="hd-discord-copy">
        <strong>{validUserId ? "Connecting Discord…" : "Discord Presence"}</strong>
        <small>
          {error ||
            (preview
              ? "Nhập User ID để xem thử widget."
              : "Presence đang được tải.")}
        </small>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        className={`hd-discord-card ${presence ? "is-ready" : "is-loading"} ${
          presence?.nameplate ? "has-nameplate" : ""
        }`}
        data-nameplate={presence?.nameplate?.palette || undefined}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={
          presence
            ? `Discord của ${presence.displayName}: ${statusLabels[presence.status]}`
            : "Discord presence"
        }
      >
        {content}
      </a>
    );
  }

  return (
    <div className="hd-discord-card is-loading" aria-live="polite">
      {content}
    </div>
  );
}
