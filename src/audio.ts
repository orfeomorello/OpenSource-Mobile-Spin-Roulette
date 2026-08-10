export type SoundId = "bet" | "close" | "spin" | "tick" | "settle" | "pay" | "error" | "bonus" | "level";

/** Looping BGM beds / modes (files in `public/audio/`). */
export type MusicTrackId = "menu" | "dealer" | "player";
export type PlayerMusicTrackId =
  | "bossa-nova-jazz"
  | "bossa-nova-lounge"
  | "bossa-nova-restaurant"
  | "cooking-music"
  | "elevator-jazz"
  | "hotel-cafe-restaurant";
export type PlayerMusicMode = "random" | PlayerMusicTrackId;

export const PLAYER_MUSIC_TRACKS: readonly { id: PlayerMusicTrackId; label: string; url: string }[] = [
  { id: "bossa-nova-jazz", label: "Bossa Nova Jazz", url: "./audio/andriih-bossa-nova-bossa-nova-jazz-575813.mp3" },
  { id: "bossa-nova-lounge", label: "Bossa Nova Lounge", url: "./audio/andriih-bossa-nova-lounge-music-571055.mp3" },
  { id: "bossa-nova-restaurant", label: "Bossa Nova Restaurant", url: "./audio/andriih-bossa-nova-restaurant-music-572268.mp3" },
  { id: "cooking-music", label: "Cooking Music", url: "./audio/andriih-cooking-cooking-music-575825.mp3" },
  { id: "elevator-jazz", label: "Elevator Jazz", url: "./audio/andriih-elevator-elevator-jazz-579808.mp3" },
  { id: "hotel-cafe-restaurant", label: "Hotel Cafe Restaurant", url: "./audio/andriih-hotel-cafe-restaurant-music-579812.mp3" },
];

const PLAYER_MUSIC_URLS = Object.fromEntries(
  PLAYER_MUSIC_TRACKS.map(({ id, url }) => [id, url]),
) as Record<PlayerMusicTrackId, string>;

/** Relative paths — required for itch.io / non-root hosting. */
const MUSIC_URLS: Record<"menu" | "dealer", string> = {
  menu: "./audio/mus_menu_loop.mp3",
  dealer: "./audio/mus_dealer_loop.wav",
};

/**
 * Player mode: random playlist (Andrii H / Pixabay).
 * Each track plays once, then a short gap, then another track ≠ previous.
 */
/** Silence between player tracks (ms). */
const PLAYER_GAP_MS = 2000;

/** Default BGM level (50% on the Settings slider). */
const DEFAULT_MUSIC_VOLUME = 0.5;

let context: AudioContext | null = null;
let muted = false;
/** Linear 0–1 user music gain (before mute). */
let musicVolume = DEFAULT_MUSIC_VOLUME;
let desiredMusic: MusicTrackId | null = null;
let playerMusicMode: PlayerMusicMode = "random";
let musicEl: HTMLAudioElement | null = null;
let unlockBound = false;
/** Last player playlist URL (avoid immediate repeat). */
let playerLastUrl: string | null = null;
let playerGapTimer: number | null = null;
let playerEndedHandler: (() => void) | null = null;

export function setMuted(value: boolean): void {
  muted = value;
  applyMusic();
}

export function isMuted(): boolean {
  return muted;
}

/** Set music volume 0–1 (clamped). Applies immediately to the playing element. */
export function setMusicVolume(value: number): void {
  musicVolume = clamp01(value);
  if (musicEl) musicEl.volume = effectiveMusicVolume();
}

export function getMusicVolume(): number {
  return musicVolume;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MUSIC_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function effectiveMusicVolume(): number {
  return muted ? 0 : musicVolume;
}

/**
 * Select BGM mode. Pass `null` to stop.
 * Respects mute; browsers may delay start until the first user gesture.
 */
export function setMusic(track: MusicTrackId | null): void {
  desiredMusic = track;
  applyMusic();
}

export function getMusic(): MusicTrackId | null {
  return desiredMusic;
}

export function setPlayerMusicMode(mode: PlayerMusicMode): void {
  if (playerMusicMode === mode) return;
  playerMusicMode = mode;
  if (desiredMusic === "player") {
    disposeMusicElement();
    applyMusic();
  }
}

export function getPlayerMusicMode(): PlayerMusicMode {
  return playerMusicMode;
}

export function playSound(id: SoundId): void {
  if (muted) return;
  context ??= new AudioContext();
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const sounds: Record<SoundId, [number, number, OscillatorType]> = {
    bet: [260, 0.05, "square"], close: [130, 0.16, "square"], spin: [180, 0.35, "sawtooth"],
    tick: [520, 0.025, "square"], settle: [760, 0.18, "triangle"], pay: [440, 0.06, "square"],
    error: [90, 0.2, "sawtooth"], bonus: [880, 0.25, "square"], level: [660, 0.3, "triangle"],
  };
  const [frequency, duration, type] = sounds[id];
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * (id === "error" ? 0.55 : 1.4)), now + duration);
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function bindUnlockOnce(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = (): void => {
    void context?.resume();
    applyMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function clearPlayerGap(): void {
  if (playerGapTimer != null && typeof window !== "undefined") {
    window.clearTimeout(playerGapTimer);
    playerGapTimer = null;
  }
}

function detachPlayerEnded(): void {
  if (musicEl && playerEndedHandler) {
    musicEl.removeEventListener("ended", playerEndedHandler);
  }
  playerEndedHandler = null;
}

function disposeMusicElement(): void {
  detachPlayerEnded();
  clearPlayerGap();
  if (!musicEl) return;
  musicEl.pause();
  musicEl.removeAttribute("src");
  musicEl.load();
  musicEl = null;
}

function pickNextPlayerUrl(): string {
  const list = Object.values(PLAYER_MUSIC_URLS);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  let next = list[Math.floor(Math.random() * list.length)]!;
  // Prefer a different track than the last one played.
  for (let i = 0; i < 12 && next === playerLastUrl; i++) {
    next = list[Math.floor(Math.random() * list.length)]!;
  }
  return next;
}

function scheduleNextPlayerTrack(): void {
  clearPlayerGap();
  if (typeof window === "undefined") return;
  if (desiredMusic !== "player" || muted) return;
  playerGapTimer = window.setTimeout(() => {
    playerGapTimer = null;
    if (desiredMusic !== "player" || muted) return;
    startPlayerTrack(pickNextPlayerUrl());
  }, PLAYER_GAP_MS);
}

function startPlayerTrack(url: string, loop = false): void {
  if (!url || typeof Audio === "undefined") return;
  detachPlayerEnded();
  clearPlayerGap();
  if (musicEl) {
    musicEl.pause();
    musicEl.removeAttribute("src");
    musicEl.load();
  }
  musicEl = new Audio(url);
  musicEl.loop = loop;
  musicEl.preload = "auto";
  musicEl.dataset.track = "player";
  musicEl.dataset.url = url;
  playerLastUrl = url;
  if (!loop) {
    playerEndedHandler = () => {
      if (desiredMusic !== "player") return;
      scheduleNextPlayerTrack();
    };
    musicEl.addEventListener("ended", playerEndedHandler);
  }
  musicEl.volume = effectiveMusicVolume();
  void musicEl.play().catch(() => {
    /* Autoplay blocked until unlock gesture. */
  });
}

function applyMusic(): void {
  if (typeof Audio === "undefined") return;

  if (!desiredMusic || muted) {
    clearPlayerGap();
    if (musicEl) musicEl.pause();
    if (!desiredMusic) disposeMusicElement();
    return;
  }

  bindUnlockOnce();

  // Player: random playlist, no self-loop; gap then next ≠ previous.
  if (desiredMusic === "player") {
    const fixedUrl = playerMusicMode === "random" ? null : PLAYER_MUSIC_URLS[playerMusicMode];
    if (musicEl?.dataset.track === "player" && musicEl.getAttribute("src") && (!fixedUrl || musicEl.dataset.url === fixedUrl)) {
      musicEl.loop = fixedUrl !== null;
      musicEl.volume = effectiveMusicVolume();
      void musicEl.play().catch(() => {
        /* wait for unlock */
      });
      return;
    }
    startPlayerTrack(fixedUrl ?? pickNextPlayerUrl(), fixedUrl !== null);
    return;
  }

  // Menu / Dealer: single looping beds.
  clearPlayerGap();
  detachPlayerEnded();

  const url = MUSIC_URLS[desiredMusic];
  if (!musicEl || musicEl.dataset.track !== desiredMusic) {
    if (musicEl) {
      musicEl.pause();
      musicEl.removeAttribute("src");
      musicEl.load();
    }
    musicEl = new Audio(url);
    musicEl.loop = true;
    musicEl.preload = "auto";
    musicEl.dataset.track = desiredMusic;
  } else {
    musicEl.loop = true;
  }

  musicEl.volume = effectiveMusicVolume();
  void musicEl.play().catch(() => {
    /* Autoplay blocked until unlock gesture — bindUnlockOnce will retry. */
  });
}
