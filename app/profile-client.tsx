"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProfileConfig } from "@/lib/profile";

type Props = {
  initialProfile: {
    config: ProfileConfig;
    views: number;
  };
};

function domainLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfileClient({ initialProfile }: Props) {
  const { config } = initialProfile;
  const [views, setViews] = useState(initialProfile.views);
  const [entered, setEntered] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeTrack = config.tracks[trackIndex];

  useEffect(() => {
    if (!entered) return;
    fetch("/api/view", { method: "POST" })
      .then((response) => response.json())
      .then((payload) => {
        if (typeof payload.views === "number") setViews(payload.views);
      })
      .catch(() => undefined);
  }, [entered]);

  useEffect(() => {
    if (!audioRef.current || !activeTrack) return;
    audioRef.current.load();
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [activeTrack, playing]);

  const backgroundStyle = useMemo(
    () =>
      config.backgroundType === "image" && config.backgroundUrl
        ? { backgroundImage: `url("${config.backgroundUrl}")` }
        : undefined,
    [config.backgroundType, config.backgroundUrl],
  );

  const nextTrack = () => {
    if (!config.tracks.length) return;
    setTrackIndex((current) => (current + 1) % config.tracks.length);
  };

  if (!entered) {
    return (
      <main
        className="entrance"
        style={{ "--accent": config.accentColor } as React.CSSProperties}
      >
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <button className="enter-button" onClick={() => setEntered(true)}>
          <span className="enter-mark">HD</span>
          <span>enter profile</span>
        </button>
        <p className="entrance-note">sound may play</p>
      </main>
    );
  }

  return (
    <main
      className="profile-page"
      style={
        {
          "--accent": config.accentColor,
          "--card-opacity": config.cardOpacity,
          "--card-blur": `${config.blur}px`,
          ...backgroundStyle,
        } as React.CSSProperties
      }
    >
      {config.backgroundType === "video" && config.backgroundUrl ? (
        <video
          className="background-video"
          src={config.backgroundUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}
      <div className="background-shade" />
      <div className="noise" />
      <div className="orb orb-one" />
      <div className="orb orb-two" />

      <section className="profile-card" aria-label={`${config.displayName} profile`}>
        <div className="profile-topline">
          <span className="signal">
            <span className="signal-dot" />
            {config.status}
          </span>
          {config.showViews ? (
            <span className="views" title="Profile views">
              ◉ {views.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>

        <div className="identity">
          <div className="avatar-wrap">
            {config.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.avatarUrl} alt={config.displayName} />
            ) : (
              <span>{initials(config.displayName)}</span>
            )}
          </div>
          <p className="eyebrow">{config.handle}</p>
          <h1>{config.displayName}</h1>
          <p className="bio">{config.bio}</p>
          <p className="location">⌖ {config.location}</p>
        </div>

        <div className="link-grid">
          {config.links
            .filter((link) => link.visible && link.url)
            .map((link, index) => (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-link"
                key={link.id}
              >
                <span className="link-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="link-copy">
                  <strong>{link.label}</strong>
                  <small>{link.subtitle || domainLabel(link.url)}</small>
                </span>
                <span className="link-arrow">↗</span>
              </a>
            ))}
        </div>

        {config.musicEnabled && activeTrack ? (
          <div className="music-dock">
            <button
              className="play-button"
              aria-label={playing ? "Pause music" : "Play music"}
              onClick={() => {
                if (!audioRef.current) return;
                if (playing) {
                  audioRef.current.pause();
                  setPlaying(false);
                } else {
                  audioRef.current
                    .play()
                    .then(() => setPlaying(true))
                    .catch(() => setPlaying(false));
                }
              }}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <div className="track-copy">
              <strong>{activeTrack.title}</strong>
              <span>{activeTrack.artist}</span>
            </div>
            <div className={`equalizer ${playing ? "is-playing" : ""}`}>
              <i />
              <i />
              <i />
              <i />
            </div>
            {config.tracks.length > 1 ? (
              <button className="next-button" onClick={nextTrack} aria-label="Next track">
                ›
              </button>
            ) : null}
            <audio
              ref={audioRef}
              src={activeTrack.url}
              onEnded={nextTrack}
              preload="metadata"
            />
          </div>
        ) : null}
      </section>

      <a className="edit-link" href="/admin">
        customize
      </a>
    </main>
  );
}
