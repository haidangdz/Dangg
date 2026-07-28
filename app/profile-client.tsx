"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProfileConfig } from "@/lib/profile";

type Props = {
  initialProfile: { config: ProfileConfig; views: number };
};

type LyricLine = {
  time: number;
  text: string;
};

type PetMood =
  | "idle"
  | "watching"
  | "dragging"
  | "poked"
  | "spitting"
  | "staffing"
  | "landing";

type PetSkin = "classic" | "wuxiang";

type PetAttack = {
  id: number;
  kind: "spit" | "staff";
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  dx: number;
  dy: number;
};

const BIO_MESSAGES = [
  "I love You",
  "Family, Money, Car, Game, Music, Immersed in a dream world",
  "Trying to better my self",
];

function parseLrc(source: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of source.split(/\r?\n/)) {
    const match = row.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (!match) continue;
    lines.push({
      time: Number(match[1]) * 60 + Number(match[2]),
      text: match[3].trim(),
    });
  }
  return lines.sort((a, b) => a.time - b.time);
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function initials(name: string) {
  return name.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function socialMark(label: string) {
  const value = label.toLowerCase();
  if (value.includes("facebook")) return "f";
  if (value.includes("instagram")) return "◎";
  if (value.includes("tiktok")) return "♪";
  if (value.includes("discord")) return "◖◗";
  if (value.includes("github")) return "⌘";
  return "↗";
}

function findNearbyPetTarget(x: number, y: number) {
  const sourceY = y - 64;
  const frames = Array.from(
    document.querySelectorAll<HTMLElement>(".hd-profile, .hd-holo-console"),
  ).map((element) => element.getBoundingClientRect());
  const candidates = frames.map((frame) => {
    let targetX = Math.min(frame.right, Math.max(frame.left, x));
    let targetY = Math.min(frame.bottom, Math.max(frame.top, sourceY));

    if (
      x >= frame.left &&
      x <= frame.right &&
      sourceY >= frame.top &&
      sourceY <= frame.bottom
    ) {
      const edges = [
        { distance: x - frame.left, x: frame.left, y: sourceY },
        { distance: frame.right - x, x: frame.right, y: sourceY },
        { distance: sourceY - frame.top, x, y: frame.top },
        { distance: frame.bottom - sourceY, x, y: frame.bottom },
      ].sort((a, b) => a.distance - b.distance);
      targetX = edges[0].x;
      targetY = edges[0].y;
    }

    return {
      x: targetX,
      y: targetY,
      distance: Math.hypot(targetX - x, targetY - sourceY),
    };
  });
  const closest = candidates.sort((a, b) => a.distance - b.distance)[0];
  return closest && closest.distance <= 290 ? closest : null;
}

export function ProfileClient({ initialProfile }: Props) {
  const { config } = initialProfile;
  const rootRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicStackRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  const [views, setViews] = useState(initialProfile.views);
  const [clock, setClock] = useState("");
  const [typedBio, setTypedBio] = useState("");
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [petPosition, setPetPosition] = useState({ x: 0, y: 0 });
  const [petReady, setPetReady] = useState(false);
  const [petMood, setPetMood] = useState<PetMood>("idle");
  const [petLeaf, setPetLeaf] = useState<{ id: number; side: "left" | "right" } | null>(null);
  const [petFacing, setPetFacing] = useState<1 | -1>(1);
  const [petAttack, setPetAttack] = useState<PetAttack | null>(null);
  const [petSkin, setPetSkin] = useState<PetSkin>("classic");
  const [mobileMusicVisible, setMobileMusicVisible] = useState(false);
  const petMoodRef = useRef<PetMood>("idle");
  const petPositionRef = useRef(petPosition);
  const petActionTimerRef = useRef<number | null>(null);
  const lastVolumeRef = useRef(0.7);
  const petDragRef = useRef({ active: false, moved: false, offsetX: 0, offsetY: 0 });
  const activeTrack = config.tracks[trackIndex];
  const spotifyTrack = activeTrack?.url.includes("open.spotify.com/embed/");
  const visibleLinks = config.links.filter((link) => link.visible && link.url);
  const avatarUrl = config.avatarUrl || "/avatar/haidang-night.png";

  const backgroundStyle = useMemo(
    () => config.backgroundType === "image" && config.backgroundUrl
      ? { backgroundImage: `url("${config.backgroundUrl}")` }
      : undefined,
    [config.backgroundType, config.backgroundUrl],
  );

  useEffect(() => {
    if (!entered) return;
    fetch("/api/view", { method: "POST" })
      .then((response) => response.json())
      .then((payload) => typeof payload.views === "number" && setViews(payload.views))
      .catch(() => undefined);

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let typingTimer: number | null = null;
    setTypedBio("");

    const typeNext = () => {
      const phrase = BIO_MESSAGES[phraseIndex];

      if (!deleting) {
        characterIndex += 1;
        setTypedBio(phrase.slice(0, characterIndex));
        if (characterIndex >= phrase.length) {
          deleting = true;
          typingTimer = window.setTimeout(typeNext, 1350);
        } else {
          typingTimer = window.setTimeout(typeNext, 52);
        }
        return;
      }

      characterIndex -= 1;
      setTypedBio(phrase.slice(0, Math.max(0, characterIndex)));
      if (characterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % BIO_MESSAGES.length;
        typingTimer = window.setTimeout(typeNext, 380);
      } else {
        typingTimer = window.setTimeout(typeNext, 27);
      }
    };

    typingTimer = window.setTimeout(typeNext, 420);
    return () => {
      if (typingTimer !== null) window.clearTimeout(typingTimer);
    };
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    const node = musicStackRef.current;
    if (!node) return;

    const mobileQuery = window.matchMedia("(max-width: 820px)");
    let observer: IntersectionObserver | null = null;

    const updateReveal = () => {
      observer?.disconnect();
      observer = null;

      if (!mobileQuery.matches) {
        setMobileMusicVisible(true);
        return;
      }

      setMobileMusicVisible(false);
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        setMobileMusicVisible(true);
        observer?.unobserve(entry.target);
      }, {
        threshold: 0.16,
        rootMargin: "0px 0px -10% 0px",
      });
      observer.observe(node);
    };

    updateReveal();
    mobileQuery.addEventListener("change", updateReveal);
    return () => {
      observer?.disconnect();
      mobileQuery.removeEventListener("change", updateReveal);
    };
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    const updateClock = () => setClock(new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [entered]);

  useEffect(() => {
    let cancelled = false;
    setLyricLines([]);
    setCurrentTime(0);
    if (!activeTrack?.lrcUrl) return;
    fetch(activeTrack.lrcUrl)
      .then((response) => response.text())
      .then((source) => {
        if (!cancelled) setLyricLines(parseLrc(source));
      })
      .catch(() => {
        if (!cancelled) setLyricLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTrack?.lrcUrl]);

  useEffect(() => {
    if (!audioRef.current || !activeTrack || spotifyTrack) return;
    audioRef.current.load();
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [activeTrack, spotifyTrack]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [entered, volume]);

  useEffect(() => {
    if (!entered) return;
    const frame = window.requestAnimationFrame(() => {
      setPetPosition({
        x: window.innerWidth * 0.78,
        y: window.innerHeight * 0.5,
      });
      setPetReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entered]);

  useEffect(() => {
    petMoodRef.current = petMood;
  }, [petMood]);

  useEffect(() => {
    petPositionRef.current = petPosition;
  }, [petPosition]);

  useEffect(() => {
    const savedSkin = window.localStorage.getItem("hd-pet-skin");
    if (savedSkin === "classic" || savedSkin === "wuxiang") {
      setPetSkin(savedSkin);
    }
  }, []);

  useEffect(() => {
    if (!entered || !petReady) return;
    let cycle = 0;
    let wakeTimer: number | null = null;
    let finishTimer: number | null = null;
    const idleCycle = window.setInterval(() => {
      if (petDragRef.current.active || petMoodRef.current !== "idle") return;
      cycle += 1;
      const position = petPositionRef.current;
      const target = findNearbyPetTarget(position.x, position.y);
      const choices = target
        ? ["sleep", "leaf", "spit", "staff"]
        : ["sleep", "leaf", "leaf"];
      const action = choices[Math.floor(Math.random() * choices.length)];

      if (action === "sleep") return;

      if (action === "leaf") {
        setPetLeaf({ id: cycle, side: cycle % 2 === 0 ? "left" : "right" });
        wakeTimer = window.setTimeout(() => {
          if (petMoodRef.current === "idle") setPetMood("watching");
        }, 720);
        finishTimer = window.setTimeout(() => {
          if (petMoodRef.current === "watching") setPetMood("idle");
          setPetLeaf(null);
        }, 3150);
        return;
      }

      if (!target) return;
      const facing: 1 | -1 = target.x >= position.x ? 1 : -1;
      const startX = position.x + facing * 30;
      const startY = position.y - 66;
      const nextMood: PetMood = action === "spit" ? "spitting" : "staffing";
      setPetFacing(facing);
      petMoodRef.current = nextMood;
      setPetMood(nextMood);
      setPetAttack({
        id: cycle,
        kind: action as "spit" | "staff",
        startX,
        startY,
        targetX: target.x,
        targetY: target.y,
        dx: target.x - startX,
        dy: target.y - startY,
      });
      finishTimer = window.setTimeout(() => {
        if (petMoodRef.current === nextMood) setPetMood("idle");
        setPetAttack(null);
      }, action === "spit" ? 2600 : 3500);
    }, 7800);

    return () => {
      window.clearInterval(idleCycle);
      if (wakeTimer !== null) window.clearTimeout(wakeTimer);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
      if (petActionTimerRef.current !== null) {
        window.clearTimeout(petActionTimerRef.current);
      }
    };
  }, [entered, petReady]);

  let activeLyricIndex = -1;
  for (let index = 0; index < lyricLines.length; index += 1) {
    if (lyricLines[index].time <= currentTime + 0.05) activeLyricIndex = index;
    else break;
  }
  const displayLyricIndex = Math.max(0, activeLyricIndex);
  const lyricWindow = lyricLines.length
    ? lyricLines
        .map((line, index) => ({ ...line, index }))
        .slice(Math.max(0, displayLyricIndex - 1), displayLyricIndex + 2)
    : (activeTrack?.lyrics || "No lyrics added yet")
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, 3)
        .map((text, index) => ({ time: index, text, index }));

  const nextTrack = () => {
    if (config.tracks.length) setTrackIndex((current) => (current + 1) % config.tracks.length);
  };

  const previousTrack = () => {
    if (config.tracks.length) {
      setTrackIndex((current) => (current - 1 + config.tracks.length) % config.tracks.length);
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const enterProfile = () => {
    setEntered(true);
    window.requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => setPlaying(false));
    });
  };

  if (!entered) {
    return (
      <main className="hd-gate" style={{ "--accent": config.accentColor, ...backgroundStyle } as React.CSSProperties}>
        <div className="hd-gate-shade" />
        <div className="hd-grain" />
        <button onClick={enterProfile} className="hd-enter">
          <span className="hd-enter-ring"><i /></span>
          <strong>enter</strong>
        </button>
      </main>
    );
  }

  return (
    <main
      ref={rootRef}
      className="hd-site"
      style={{
        "--accent": config.accentColor,
        "--card-opacity": config.cardOpacity,
        "--card-blur": `${config.blur}px`,
        ...backgroundStyle,
      } as React.CSSProperties}
      onPointerMove={(event) => {
        const root = rootRef.current;
        if (!root) return;
        root.style.setProperty("--mx", `${event.clientX}px`);
        root.style.setProperty("--my", `${event.clientY}px`);
        root.style.setProperty("--rx", `${(event.clientY / innerHeight - .5) * -3}deg`);
        root.style.setProperty("--ry", `${(event.clientX / innerWidth - .5) * 4}deg`);
      }}
    >
      {config.backgroundType === "video" && config.backgroundUrl ? (
        <video className="hd-video" src={config.backgroundUrl} autoPlay muted loop playsInline />
      ) : null}
      <div className="hd-backdrop" />
      <div className="hd-grain" />
      <div className="hd-scan" />
      <div className="hd-cursor" />

      <header className="hd-chrome">
        <span>{config.handle}</span>
        <span className="hd-clock">{clock}</span>
      </header>

      <section id="profile" className="hd-panel hd-hero hd-seen" data-section="0">
        <div className="hd-hero-ghost" aria-hidden="true">{config.displayName}</div>
        <div className="hd-widget-layout">
          <article className="hd-profile">
            <div className="hd-profile-line" />
            <div className="hd-avatar">
              <div className="hd-avatar-media">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={config.displayName} />
                ) : <span>{initials(config.displayName)}</span>}
              </div>
              <span className="hd-avatar-glitch-frame" aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </span>
            </div>
            <span className="hd-views">◉ {views.toLocaleString("en-US")}</span>
            <p className="hd-handle">{config.handle}</p>
            <div className="hd-name-row">
              <h1 data-text={config.displayName}>{config.displayName}</h1>
              <div className="hd-badges" aria-label="Profile badges">
                <span title="verified">✦</span><span title="night owl">☾</span><span title="music">♫</span>
              </div>
            </div>
            <p className="hd-typed">{typedBio}<i /></p>
            <div className="hd-profile-actions">
              <div className="hd-socials">
                {visibleLinks.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                    <b>{socialMark(link.label)}</b><span>{link.label}</span>
                  </a>
                ))}
              </div>
              <button
                className={`hd-pet-skin-toggle ${petSkin === "wuxiang" ? "active" : ""}`}
                type="button"
                aria-pressed={petSkin === "wuxiang"}
                onClick={() => {
                  const nextSkin: PetSkin = petSkin === "classic" ? "wuxiang" : "classic";
                  setPetSkin(nextSkin);
                  window.localStorage.setItem("hd-pet-skin", nextSkin);
                  setPetLeaf(null);
                  setPetAttack(null);
                }}
              >
                <i aria-hidden="true">相</i>
                <span>PET SKIN</span>
                <strong>{petSkin === "wuxiang" ? "VÔ TƯỚNG" : "ĐẠI THÁNH"}</strong>
                <b aria-hidden="true">↔</b>
              </button>
            </div>
          </article>

          <aside
            ref={musicStackRef}
            className={`hd-widget-stack hd-mobile-reveal ${mobileMusicVisible ? "is-visible" : ""}`}
          >
            {config.musicEnabled && activeTrack ? (
              <section className="hd-holo-widget">
                <div className="hd-holo-stage">
                  <div className="hd-holo-beam" />
                  <div className="hd-holo-lines" />
                  <div className="hd-holo-lyrics" key={activeTrack.id}>
                    <small>LYRICS · {String(trackIndex + 1).padStart(2, "0")}/{String(config.tracks.length).padStart(2, "0")}</small>
                    <div className="hd-holo-lyric-viewport">
                    {lyricWindow.map((line) => {
                      const position = line.index - displayLyricIndex;
                      return (
                      <p
                        className={
                          position < 0 ? "previous" : position > 0 ? "next" : "active"
                        }
                        key={`${line.time}-${line.text}`}
                      >
                        {line.text}
                      </p>
                      );
                    })}
                    </div>
                  </div>
                </div>

                <div className="hd-holo-console">
                  <div className={`hd-mini-disc ${playing ? "playing" : ""}`}><i /></div>
                  <div className="hd-mini-track">
                    <small>{String(trackIndex + 1).padStart(2, "0")} · NOW PLAYING</small>
                    <strong>{activeTrack.title}</strong>
                    <span>{activeTrack.artist}</span>
                  </div>
                  {spotifyTrack ? (
                  <div className="hd-track-actions">
                    <button onClick={previousTrack} aria-label="Previous song">‹</button>
                    <button onClick={nextTrack} aria-label="Next song">›</button>
                  </div>
                  ) : (
                    <div className="hd-track-actions">
                      <button onClick={previousTrack} aria-label="Previous song">‹</button>
                      <button className="hd-mini-play" onClick={toggleMusic} aria-label={playing ? "Pause" : "Play"}>
                        {playing ? "Ⅱ" : "▶"}
                      </button>
                      <button onClick={nextTrack} aria-label="Next song">›</button>
                    </div>
                  )}
                  {!spotifyTrack ? (
                    <>
                      <div className="hd-progress">
                        <span>{formatTime(currentTime)}</span>
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          step="0.05"
                          value={Math.min(currentTime, duration || 0)}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (audioRef.current) audioRef.current.currentTime = value;
                            setCurrentTime(value);
                          }}
                          aria-label="Seek audio"
                        />
                        <span>{formatTime(duration)}</span>
                      </div>
                      <div className="hd-volume">
                        <button
                          type="button"
                          onClick={() => {
                            if (volume > 0) {
                              lastVolumeRef.current = volume;
                              setVolume(0);
                            } else {
                              setVolume(lastVolumeRef.current || 0.7);
                            }
                          }}
                          aria-label={volume > 0 ? "Mute music" : "Unmute music"}
                          title={volume > 0 ? "Mute" : "Unmute"}
                        >
                          {volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value > 0) lastVolumeRef.current = value;
                            setVolume(value);
                          }}
                          aria-label="Music volume"
                        />
                        <span>{Math.round(volume * 100)}%</span>
                      </div>
                      <audio
                        ref={audioRef}
                        src={activeTrack.url}
                        preload="metadata"
                        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                        onEnded={() => {
                          setPlaying(true);
                          nextTrack();
                        }}
                      />
                    </>
                  ) : null}
                  {spotifyTrack ? (
                  <iframe
                    className="hd-widget-spotify"
                    src={activeTrack.url}
                    title={`${activeTrack.title} by ${activeTrack.artist}`}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                  ) : null}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </section>

      {petAttack ? (
        <span
          key={`${petAttack.kind}-${petAttack.id}`}
          className={`hd-pet-effect hd-pet-effect-${petAttack.kind} hd-pet-effect-skin-${petSkin}`}
          style={{
            left: petAttack.kind === "spit" ? petAttack.startX : petAttack.targetX,
            top: petAttack.kind === "spit" ? petAttack.startY : petAttack.targetY,
            "--pet-effect-x": `${petAttack.dx}px`,
            "--pet-effect-y": `${petAttack.dy}px`,
          } as React.CSSProperties}
          aria-hidden="true"
        >
          {petAttack.kind === "spit" ? (
            <>
              <i className="hd-water-drop hd-water-drop-one" />
              <i className="hd-water-drop hd-water-drop-two" />
              <i className="hd-water-drop hd-water-drop-three" />
              <b className="hd-water-splash"><i /><i /><i /></b>
            </>
          ) : (
            <>
              <i className="hd-staff-ring" />
              <b className="hd-staff-impact"><i /><i /><i /><i /></b>
            </>
          )}
        </span>
      ) : null}

      {petReady ? (
        <button
          className={`hd-pet hd-pet-${petMood} hd-pet-skin-${petSkin}`}
          style={{
            left: petPosition.x,
            top: petPosition.y,
            "--pet-facing": petFacing,
            "--pet-lunge": `${petFacing * 0.18}rem`,
            "--pet-lunge-big": `${petFacing * 0.34}rem`,
            "--pet-staff-step": `${petFacing * 0.22}rem`,
            "--pet-staff-recover": `${petFacing * 0.08}rem`,
            "--pet-tilt": `${petFacing * 2}deg`,
          } as React.CSSProperties}
          aria-label="Drag or poke the sleeping Monkey King"
          onPointerDown={(event) => {
            if (petActionTimerRef.current !== null) {
              window.clearTimeout(petActionTimerRef.current);
            }
            setPetLeaf(null);
            setPetAttack(null);
            event.currentTarget.setPointerCapture(event.pointerId);
            petDragRef.current = {
              active: true,
              moved: false,
              offsetX: event.clientX - petPosition.x,
              offsetY: event.clientY - petPosition.y,
            };
            petMoodRef.current = "dragging";
            setPetMood("dragging");
          }}
          onPointerMove={(event) => {
            if (!petDragRef.current.active) return;
            const x = Math.min(
              window.innerWidth - 45,
              Math.max(45, event.clientX - petDragRef.current.offsetX),
            );
            const y = Math.min(
              window.innerHeight - 5,
              Math.max(110, event.clientY - petDragRef.current.offsetY),
            );
            if (
              Math.abs(x - petPosition.x) > 3 ||
              Math.abs(y - petPosition.y) > 3
            ) {
              petDragRef.current.moved = true;
            }
            setPetPosition({ x, y });
          }}
          onPointerUp={(event) => {
            if (!petDragRef.current.active) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            const wasMoved = petDragRef.current.moved;
            petDragRef.current.active = false;
            if (wasMoved) {
              petMoodRef.current = "landing";
              setPetMood("landing");
              petActionTimerRef.current = window.setTimeout(() => {
                if (petMoodRef.current === "landing") setPetMood("idle");
              }, 980);
            } else {
              petMoodRef.current = "poked";
              setPetMood("poked");
              petActionTimerRef.current = window.setTimeout(() => {
                if (petMoodRef.current === "poked") setPetMood("idle");
              }, 920);
            }
          }}
          onPointerCancel={() => {
            if (!petDragRef.current.active) return;
            petDragRef.current.active = false;
            petMoodRef.current = "landing";
            setPetMood("landing");
            petActionTimerRef.current = window.setTimeout(() => {
              if (petMoodRef.current === "landing") setPetMood("idle");
            }, 980);
          }}
        >
          {petLeaf ? (
            <span
              key={petLeaf.id}
              className={`hd-pet-leaf hd-pet-leaf-${petLeaf.side}`}
              aria-hidden="true"
            ><i /></span>
          ) : null}
          {petMood === "dragging" ? (
            <span className="hd-pet-anger" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
          ) : null}
          <span className="hd-pet-sprite" aria-hidden="true" />
        </button>
      ) : null}

      <button
        className="hd-customize"
        type="button"
        disabled
        title="Customize will be available later"
      >
        CUSTOMIZE · SOON
      </button>
    </main>
  );
}
