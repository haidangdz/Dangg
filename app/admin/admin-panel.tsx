"use client";

import { useMemo, useState } from "react";
import type { MusicTrack, ProfileConfig, ProfileLink } from "@/lib/profile";

type Props = {
  initialConfig: ProfileConfig;
  views: number;
  userEmail: string;
};

type UploadTarget =
  | "avatarUrl"
  | "backgroundUrl"
  | { kind: "track"; id: string };

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

export function AdminPanel({
  initialConfig,
  views,
  userEmail,
}: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const visibleLinks = useMemo(
    () => config.links.filter((link) => link.visible && link.url),
    [config.links],
  );

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
      typeof target === "string" ? target : `track-${target.id}`;
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
        patch(target, payload.url);
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

  async function save() {
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
      setConfig(payload.config);
      setNotice("Saved. Your public profile is updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
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
          <a href="/" target="_blank">
            Open profile ↗
          </a>
          <button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
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
                Bio
                <textarea
                  value={config.bio}
                  rows={3}
                  maxLength={240}
                  onChange={(event) => patch("bio", event.target.value)}
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
                    ? "Uploading…"
                    : "Upload image or video"}
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
                <p>Add, hide or remove up to 12 destinations.</p>
              </div>
              <button
                className="add-button"
                onClick={() =>
                  patch("links", [
                    ...config.links,
                    {
                      id: id(),
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
                  <div className="collection-fields">
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
                <h2>Music</h2>
                <p>Paste a direct audio URL or upload your own file.</p>
              </div>
              <button
                className="add-button"
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
                    <textarea
                      aria-label="Track lyrics"
                      value={track.lyrics}
                      placeholder="One lyric line per row"
                      rows={3}
                      onChange={(event) =>
                        updateTrack(track.id, { lyrics: event.target.value })
                      }
                    />
                    <input
                      aria-label="Timed lyrics URL"
                      value={track.lrcUrl}
                      placeholder="LRC URL (optional)"
                      onChange={(event) =>
                        updateTrack(track.id, { lrcUrl: event.target.value })
                      }
                    />
                    <label className="mini-upload">
                      {uploading === `track-${track.id}`
                        ? "Uploading…"
                        : "Upload audio"}
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            upload(file, { kind: "track", id: track.id });
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
              <span>05</span>
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
            <small>signed in as {userEmail}</small>
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
            <div className="mini-card">
              <div className="mini-stats">
                <span>● {config.status}</span>
                {config.showViews ? <span>◉ {views}</span> : null}
              </div>
              <div className="mini-avatar">
                {config.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.avatarUrl} alt="" />
                ) : (
                  initials(config.displayName)
                )}
              </div>
              <small>{config.handle}</small>
              <h3>{config.displayName}</h3>
              <p>{config.bio}</p>
              <div className="mini-links">
                {visibleLinks.slice(0, 5).map((link) => (
                  <span key={link.id}>
                    <i>{link.label.slice(0, 1)}</i>
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
    </main>
  );
}
