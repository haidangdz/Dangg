"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MusicTrack, ProfileConfig, ProfileLink } from "@/lib/profile";
import {
  SOCIAL_ICONS,
  socialIcon,
  type SocialIconId,
} from "@/lib/social-icons";
import { SocialIcon } from "@/app/social-icon";
import { DiscordPresenceCard } from "@/app/discord-presence-card";

type Props = {
  initialConfig: ProfileConfig;
  views: number;
};

type UploadTarget =
  | "avatarUrl"
  | "backgroundUrl"
  | { kind: "track-audio" | "track-lrc"; id: string };

const AVATAR_FRAME_OPTIONS: Array<{
  id: ProfileConfig["avatarFrame"];
  label: string;
  description: string;
}> = [
  { id: "glitch", label: "Glitch", description: "RGB signal break" },
  { id: "halo", label: "Halo", description: "Purple pulse" },
  { id: "frost", label: "Frost", description: "Ice blue glow" },
  { id: "eclipse", label: "Eclipse", description: "Black & white orbit" },
  { id: "ember", label: "Ember", description: "Burning orange" },
];

function id() {
  return crypto.randomUUID();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TimedLyricsStatus({ url }: { url: string }) {
  const [status, setStatus] = useState<{
    kind: "idle" | "checking" | "ready" | "error";
    message: string;
  }>({ kind: "idle", message: "" });

  useEffect(() => {
    if (!url) {
      setStatus({ kind: "idle", message: "Chưa gắn file LRC." });
      return;
    }

    const controller = new AbortController();
    setStatus({ kind: "checking", message: "Đang kiểm tra file LRC…" });

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Không đọc được file.");
        return response.text();
      })
      .then((source) => {
        const lineCount = source
          .split(/\r?\n/)
          .filter((line) =>
            /^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\].+/.test(line.trim()),
          ).length;
        if (!lineCount) throw new Error("File không có dòng timestamp hợp lệ.");
        setStatus({
          kind: "ready",
          message: `Đã nhận ${lineCount} dòng timed lyrics. Player sẽ tự đồng bộ theo nhạc.`,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Không kiểm tra được file LRC.",
        });
      });

    return () => controller.abort();
  }, [url]);

  return (
    <div className={`track-lrc-status is-${status.kind}`}>
      <strong>
        {status.kind === "ready"
          ? "✓ LRC đã kết nối"
          : status.kind === "error"
            ? "LRC có lỗi"
            : "Timed lyrics"}
      </strong>
      <span>{status.message}</span>
      {status.kind === "ready" ? (
        <small>Ô lyrics thường phía trên có thể để trống.</small>
      ) : null}
    </div>
  );
}

export function AdminPanel({
  initialConfig,
  views,
}: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [exitDialog, setExitDialog] = useState(false);
  const savedSnapshotRef = useRef(JSON.stringify(initialConfig));
  const allowExitRef = useRef(false);
  const visibleLinks = useMemo(
    () => config.links.filter((link) => link.visible && link.url),
    [config.links],
  );
  const dirty = useMemo(
    () => JSON.stringify(config) !== savedSnapshotRef.current,
    [config],
  );

  useEffect(() => {
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      if (!dirty || allowExitRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const lockOnExit = () => {
      navigator.sendBeacon("/api/admin/logout");
    };

    window.addEventListener("beforeunload", warnBeforeExit);
    window.addEventListener("pagehide", lockOnExit);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeExit);
      window.removeEventListener("pagehide", lockOnExit);
    };
  }, [dirty]);

  const patch = <K extends keyof ProfileConfig>(
    key: K,
    value: ProfileConfig[K],
  ) => setConfig((current) => ({ ...current, [key]: value }));

  const updateLink = (linkId: string, next: Partial<ProfileLink>) =>
    patch(
      "links",
      config.links.map((link) =>
        link.id === linkId ? { ...link, ...next } : link,
      ),
    );

  const updateTrack = (trackId: string, next: Partial<MusicTrack>) =>
    patch(
      "tracks",
      config.tracks.map((track) =>
        track.id === trackId ? { ...track, ...next } : track,
      ),
    );

  async function upload(file: File, target: UploadTarget) {
    const label =
      typeof target === "string" ? target : `${target.kind}-${target.id}`;
    setUploading(label);
    setNotice("");
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed.");

      if (typeof target === "string") {
        if (target === "backgroundUrl") {
          setConfig((current) => ({
            ...current,
            backgroundUrl: payload.url,
            backgroundType: file.type.startsWith("video/")
              ? "video"
              : "image",
          }));
        } else {
          patch(target, payload.url);
        }
      } else if (target.kind === "track-lrc") {
        updateTrack(target.id, { lrcUrl: payload.url });
      } else {
        updateTrack(target.id, { url: payload.url });
      }
      setNotice(`${file.name} uploaded. Remember to save changes.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading("");
    }
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save.");
      savedSnapshotRef.current = JSON.stringify(payload.config);
      setConfig(payload.config);
      setNotice("Saved. Your public profile is updated.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function lockAndGoToProfile() {
    allowExitRef.current = true;
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/");
  }

  function requestExit() {
    if (dirty) {
      setExitDialog(true);
      return;
    }
    void lockAndGoToProfile();
  }

  async function saveAndExit() {
    if (await save()) {
      setExitDialog(false);
      await lockAndGoToProfile();
    }
  }

  return (
    <main
      className="admin-page"
      style={{ "--accent": config.accentColor } as React.CSSProperties}
    >
      <header className="admin-header">
        <div>
          <p className="admin-kicker">HD / profile studio</p>
          <h1>Customize your space.</h1>
          <p>
            Edit everything here, then hit save. No code, no redeploy.
          </p>
        </div>
        <div className="admin-actions">
          {dirty ? <span className="admin-dirty">● CHƯA LƯU</span> : null}
          <button className="admin-logout" type="button" onClick={requestExit}>
            ← Về profile
          </button>
          <button onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <section className="editor-column">
          <div className="editor-card">
            <div className="section-heading">
              <span>01</span>
              <div>
                <h2>Identity</h2>
                <p>The first five seconds of your profile.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Display name
                <input
                  value={config.displayName}
                  onChange={(event) => patch("displayName", event.target.value)}
                />
              </label>
              <label>
                Handle
                <input
                  value={config.handle}
                  onChange={(event) => patch("handle", event.target.value)}
                />
              </label>
              <label className="wide">
                Nội dung tự gõ — mỗi dòng là một câu
                <textarea
                  value={config.bioMessages.join("\n")}
                  rows={5}
                  maxLength={1200}
                  onChange={(event) =>
                    patch(
                      "bioMessages",
                      event.target.value
                        .split(/\r?\n/)
                        .map((line) => line.slice(0, 180))
                        .slice(0, 8),
                    )
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={config.location}
                  onChange={(event) => patch("location", event.target.value)}
                />
              </label>
              <label>
                Status
                <input
                  value={config.status}
                  onChange={(event) => patch("status", event.target.value)}
                />
              </label>
              <label className="wide">
                Avatar URL
                <input
                  value={config.avatarUrl}
                  placeholder="https://… or upload below"
                  onChange={(event) => patch("avatarUrl", event.target.value)}
                />
              </label>
              <label className="upload-field wide">
                <span>
                  {uploading === "avatarUrl" ? "Uploading…" : "Upload avatar"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload(file, "avatarUrl");
                  }}
                />
              </label>
              <div className="avatar-frame-field wide">
                <span>Animated avatar frame</span>
                <div className="avatar-frame-picker">
                  {AVATAR_FRAME_OPTIONS.map((frame) => (
                    <button
                      key={frame.id}
                      type="button"
                      className={`avatar-frame-option frame-${frame.id}`}
                      aria-pressed={config.avatarFrame === frame.id}
                      onClick={() => patch("avatarFrame", frame.id)}
                    >
                      <span className="avatar-frame-swatch">
                        {config.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={config.avatarUrl} alt="" />
                        ) : (
                          initials(config.displayName)
                        )}
                        <i aria-hidden="true" />
                      </span>
                      <strong>{frame.label}</strong>
                      <small>{frame.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="editor-card">
            <div className="section-heading">
              <span>02</span>
              <div>
                <h2>Visuals</h2>
                <p>Control the atmosphere without touching CSS.</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Background type
                <select
                  value={config.backgroundType}
                  onChange={(event) =>
                    patch(
                      "backgroundType",
                      event.target.value as ProfileConfig["backgroundType"],
                    )
                  }
                >
                  <option value="gradient">Animated gradient</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label>
                Accent
                <div className="color-input">
                  <input
                    type="color"
                    value={config.accentColor}
                    onChange={(event) =>
                      patch("accentColor", event.target.value)
                    }
                  />
                  <span>{config.accentColor}</span>
                </div>
              </label>
              <label className="wide">
                Background URL
                <input
                  value={config.backgroundUrl}
                  placeholder="https://… or upload below"
                  onChange={(event) =>
                    patch("backgroundUrl", event.target.value)
                  }
                />
              </label>
              <label className="upload-field wide">
                <span>
                  {uploading === "backgroundUrl"
                    ? "Đang tải lên…"
                    : "Tải ảnh hoặc video lên · tối đa 95 MB"}
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) upload(file, "backgroundUrl");
                  }}
                />
              </label>
              <label>
                Card opacity
                <input
                  type="range"
                  min="0.25"
                  max="0.9"
                  step="0.01"
                  value={config.cardOpacity}
                  onChange={(event) =>
                    patch("cardOpacity", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Glass blur
                <input
                  type="range"
                  min="8"
                  max="42"
                  value={config.blur}
                  onChange={(event) =>
                    patch("blur", Number(event.target.value))
                  }
                />
              </label>
            </div>
          </div>

          <div className="editor-card">
            <div className="section-heading">
              <span>03</span>
              <div>
                <h2>Links</h2>
                <p>Chọn icon rồi thêm, ẩn hoặc xóa tối đa 24 liên kết.</p>
              </div>
              <button
                className="add-button"
                disabled={config.links.length >= 24}
                onClick={() =>
                  patch("links", [
                    ...config.links,
                    {
                      id: id(),
                      icon: "website",
                      label: "New link",
                      subtitle: "",
                      url: "",
                      visible: true,
                    },
                  ])
                }
              >
                + Add
              </button>
            </div>
            <div className="collection">
              {config.links.map((link, index) => (
                <div className="collection-row" key={link.id}>
                  <span className="drag-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="collection-fields link-fields">
                    <div
                      className="link-icon-control"
                      style={{ color: socialIcon(link.icon).color }}
                    >
                      <SocialIcon id={link.icon} />
                      <select
                        className="link-icon-select"
                        aria-label="Social icon"
                        value={link.icon}
                        onChange={(event) =>
                          updateLink(link.id, {
                            icon: event.target.value as SocialIconId,
                          })
                        }
                      >
                        {SOCIAL_ICONS.map((icon) => (
                          <option key={icon.id} value={icon.id}>
                            {icon.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      aria-label="Link label"
                      value={link.label}
                      onChange={(event) =>
                        updateLink(link.id, { label: event.target.value })
                      }
                    />
                    <input
                      aria-label="Link subtitle"
                      value={link.subtitle}
                      placeholder="Short description"
                      onChange={(event) =>
                        updateLink(link.id, { subtitle: event.target.value })
                      }
                    />
                    <input
                      aria-label="Link URL"
                      value={link.url}
                      placeholder="https://…"
                      onChange={(event) =>
                        updateLink(link.id, { url: event.target.value })
                      }
                    />
                    {link.icon === "discord" ? (
                      <div className="discord-link-help">
                        <strong>Discord dùng link nào?</strong>
                        <span>
                          Server: <code>https://discord.gg/ma-moi</code>
                        </span>
                        <span>
                          Cá nhân: bật Developer Mode, copy User ID rồi dùng{" "}
                          <code>https://discord.com/users/USER_ID</code>
                        </span>
                        <small>
                          Chỉ nhập username Discord thì người xem không bấm mở
                          profile trực tiếp được.
                        </small>
                      </div>
                    ) : null}
                  </div>
                  <div className="row-actions">
                    <button
                      onClick={() =>
                        updateLink(link.id, { visible: !link.visible })
                      }
                    >
                      {link.visible ? "Hide" : "Show"}
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        patch(
                          "links",
                          config.links.filter((item) => item.id !== link.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-card">
            <div className="section-heading">
              <span>04</span>
              <div>
                <h2>Discord Presence</h2>
                <p>Hiện avatar, trạng thái và activity Discord trực tiếp.</p>
              </div>
            </div>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={config.discordPresenceEnabled}
                onChange={(event) =>
                  patch("discordPresenceEnabled", event.target.checked)
                }
              />
              Hiện Discord card phía trên profile
            </label>
            <div className="discord-presence-editor">
              <div className="form-grid">
                <label>
                  Discord User ID
                  <input
                    inputMode="numeric"
                    value={config.discordUserId}
                    placeholder="Ví dụ: 94490510688792576"
                    onChange={(event) =>
                      patch(
                        "discordUserId",
                        event.target.value.replace(/\D/g, "").slice(0, 22),
                      )
                    }
                  />
                </label>
                <label>
                  Link mở khi bấm card (không bắt buộc)
                  <input
                    value={config.discordProfileUrl}
                    placeholder="https://discord.com/users/USER_ID"
                    onChange={(event) =>
                      patch("discordProfileUrl", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="discord-presence-help">
                <strong>Cách kết nối</strong>
                <span>1. Discord → Settings → Advanced → bật Developer Mode.</span>
                <span>2. Bấm phải avatar của mày → Copy User ID.</span>
                <span>
                  3. Tham gia{" "}
                  <a
                    href="https://discord.gg/lanyard"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Lanyard Discord
                  </a>{" "}
                  để hệ thống đọc presence.
                </span>
                <small>
                  Sau đó dán User ID, bật công tắc và lưu. Widget tự làm mới mỗi
                  khi Discord đổi trạng thái.
                </small>
              </div>
              <fieldset className="discord-badge-picker">
                <legend>Badge hiển thị thủ công</legend>
                {([
                  ["legacy", "#", "Originally known as"],
                  ["quest", "♕", "Completed a Discord Quest"],
                  ["nitro", "◆", "Nitro subscriber"],
                ] as const).map(([badgeId, symbol, label]) => (
                  <label key={badgeId}>
                    <input
                      type="checkbox"
                      checked={config.discordBadgeIds.includes(badgeId)}
                      onChange={(event) =>
                        patch(
                          "discordBadgeIds",
                          event.target.checked
                            ? [...config.discordBadgeIds, badgeId]
                            : config.discordBadgeIds.filter(
                                (item) => item !== badgeId,
                              ),
                        )
                      }
                    />
                    <span aria-hidden="true">{symbol}</span>
                    {label}
                  </label>
                ))}
                <small>
                  Tag server như 7Màu và nameplate được lấy tự động. Ba badge
                  này chọn thủ công vì Discord Presence không gửi đầy đủ.
                </small>
              </fieldset>
              <div className="discord-presence-preview">
                <span>LIVE PREVIEW</span>
                <DiscordPresenceCard
                  userId={config.discordUserId}
                  profileUrl={config.discordProfileUrl}
                  preview
                  badges={config.discordBadgeIds}
                />
              </div>
            </div>
          </div>

          <div className="editor-card">
            <div className="section-heading">
              <span>05</span>
              <div>
                <h2>Music</h2>
                <p>Paste a direct audio URL or upload your own file.</p>
              </div>
              <button
                className="add-button"
                disabled={config.tracks.length >= 12}
                onClick={() =>
                  patch("tracks", [
                    ...config.tracks,
                    {
                      id: id(),
                      title: "New track",
                      artist: "Unknown artist",
                      url: "",
                      lyrics: "No lyrics added yet",
                      lrcUrl: "",
                    },
                  ])
                }
              >
                + Add
              </button>
            </div>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={config.musicEnabled}
                onChange={(event) =>
                  patch("musicEnabled", event.target.checked)
                }
              />
              Enable music player
            </label>
            <div className="collection">
              {config.tracks.map((track, index) => (
                <div className="collection-row" key={track.id}>
                  <span className="drag-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="collection-fields">
                    <input
                      aria-label="Track title"
                      value={track.title}
                      onChange={(event) =>
                        updateTrack(track.id, { title: event.target.value })
                      }
                    />
                    <input
                      aria-label="Track artist"
                      value={track.artist}
                      onChange={(event) =>
                        updateTrack(track.id, { artist: event.target.value })
                      }
                    />
                    <input
                      aria-label="Track URL"
                      value={track.url}
                      placeholder="https://…"
                      onChange={(event) =>
                        updateTrack(track.id, { url: event.target.value })
                      }
                    />
                    <span className="track-field-caption">
                      Lyrics thường · chỉ dùng dự phòng khi không có file LRC
                    </span>
                    <textarea
                      aria-label="Track lyrics"
                      value={track.lyrics}
                      placeholder="Có thể để trống nếu bài đã có file .lrc"
                      rows={3}
                      onChange={(event) =>
                        updateTrack(track.id, { lyrics: event.target.value })
                      }
                    />
                    <input
                      className="track-wide-input"
                      aria-label="Timed lyrics URL"
                      value={track.lrcUrl}
                      placeholder="Đường dẫn file .lrc có timestamp"
                      onChange={(event) =>
                        updateTrack(track.id, { lrcUrl: event.target.value })
                      }
                    />
                    <TimedLyricsStatus url={track.lrcUrl} />
                    <label className="mini-upload">
                      {uploading === `track-audio-${track.id}`
                        ? "Đang tải nhạc…"
                        : "Tải file nhạc lên"}
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            upload(file, {
                              kind: "track-audio",
                              id: track.id,
                            });
                        }}
                      />
                    </label>
                    <label className="mini-upload">
                      {uploading === `track-lrc-${track.id}`
                        ? "Đang tải lyrics…"
                        : "Tải file lyrics .lrc lên"}
                      <input
                        type="file"
                        accept=".lrc,text/plain"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            upload(file, {
                              kind: "track-lrc",
                              id: track.id,
                            });
                        }}
                      />
                    </label>
                  </div>
                  <div className="row-actions">
                    <button
                      className="danger"
                      onClick={() =>
                        patch(
                          "tracks",
                          config.tracks.filter((item) => item.id !== track.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-card compact-card">
            <div className="section-heading">
              <span>06</span>
              <div>
                <h2>Privacy & stats</h2>
                <p>{views.toLocaleString()} profile views recorded.</p>
              </div>
            </div>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={config.showViews}
                onChange={(event) => patch("showViews", event.target.checked)}
              />
              Show view count on public profile
            </label>
          </div>
        </section>

        <aside className="preview-column">
          <div className="preview-label">
            <span>Live preview</span>
            <small>password protected</small>
          </div>
          <div
            className="phone-preview"
            style={
              {
                "--accent": config.accentColor,
                backgroundImage:
                  config.backgroundType === "image" && config.backgroundUrl
                    ? `linear-gradient(rgba(5,4,7,.55),rgba(5,4,7,.82)),url("${config.backgroundUrl}")`
                    : undefined,
              } as React.CSSProperties
            }
          >
            {config.backgroundType === "video" && config.backgroundUrl ? (
              <video
                className="preview-background-video"
                src={config.backgroundUrl}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : null}
            <div className="mini-card">
              <div className="mini-stats">
                <span>● {config.status}</span>
                {config.showViews ? <span>◉ {views}</span> : null}
              </div>
              <div
                className={`mini-avatar frame-preview-${config.avatarFrame}`}
              >
                {config.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.avatarUrl} alt="" />
                ) : (
                  initials(config.displayName)
                )}
              </div>
              <small>{config.handle}</small>
              <h3>{config.displayName}</h3>
              <p>{config.bioMessages[0] || config.bio}</p>
              <div className="mini-links">
                {visibleLinks.slice(0, 5).map((link) => (
                  <span key={link.id}>
                    <i
                      style={{
                        color: socialIcon(link.icon).color,
                      }}
                    >
                      <SocialIcon id={link.icon} />
                    </i>
                    {link.label}
                    <b>↗</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {notice ? <div className="toast">{notice}</div> : null}
      {exitDialog ? (
        <div className="admin-exit-overlay" role="presentation">
          <div
            className="admin-exit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-exit-title"
          >
            <small>UNSAVED CHANGES</small>
            <h2 id="admin-exit-title">Lưu trước khi thoát.</h2>
            <p>
              Mày đang có thay đổi chưa lưu. Lưu xong trang sẽ tự khóa và quay
              về profile.
            </p>
            <div>
              <button type="button" onClick={() => setExitDialog(false)}>
                Ở lại chỉnh
              </button>
              <button
                type="button"
                onClick={() => void saveAndExit()}
                disabled={saving}
              >
                {saving ? "Đang lưu…" : "Lưu rồi về profile"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
