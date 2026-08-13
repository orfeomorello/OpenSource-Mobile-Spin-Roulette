type EventListener = () => void;

class FakeAudioElement {
  static created: FakeAudioElement[] = [];

  readonly dataset: Record<string, string> = {};
  readonly srcAssignments: { url: string; preload: string }[] = [];
  readonly listeners = new Map<string, EventListener>();
  preload = "auto";
  loop = false;
  volume = 1;
  ended = false;
  paused = true;
  playCount = 0;
  loadCount = 0;
  private source: string | null = null;

  constructor() {
    FakeAudioElement.created.push(this);
  }

  set src(url: string) {
    this.source = url;
    this.srcAssignments.push({ url, preload: this.preload });
  }

  getAttribute(name: string): string | null {
    return name === "src" ? this.source : null;
  }

  removeAttribute(name: string): void {
    if (name === "src") this.source = null;
  }

  addEventListener(name: string, listener: EventListener): void {
    this.listeners.set(name, listener);
  }

  removeEventListener(name: string, listener: EventListener): void {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }

  pause(): void {
    this.paused = true;
  }

  load(): void {
    this.loadCount += 1;
  }

  play(): Promise<void> {
    this.paused = false;
    this.playCount += 1;
    return Promise.resolve();
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const documentListeners = new Map<string, EventListener>();
let pageHidden = false;
const fakeDocument = {
  get hidden(): boolean { return pageHidden; },
  addEventListener(name: string, listener: EventListener): void {
    documentListeners.set(name, listener);
  },
};
const fakeWindow = {
  addEventListener(): void {},
  removeEventListener(): void {},
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
};

Object.assign(globalThis, {
  Audio: FakeAudioElement,
  document: fakeDocument,
  window: fakeWindow,
});

const audio = await import("./audio.ts");

audio.setMusic("player");
const player = FakeAudioElement.created[0]!;
assert(FakeAudioElement.created.length === 1, "Player entry should create one audio element only");
assert(player.dataset.track === "player", "first element should be the Player track");
assert(player.srcAssignments[0]?.preload === "none", "preload policy must be set before assigning src");
assert(
  audio.PLAYER_MUSIC_TRACKS.some((track) => track.url === player.srcAssignments[0]?.url),
  "Player should request one URL from the configured playlist",
);

audio.setMusic("menu");
const menu = FakeAudioElement.created[1]!;
assert(FakeAudioElement.created.length === 2, "switching screens should create only the requested menu bed");
assert(player.getAttribute("src") === null && player.loadCount > 0, "previous track should release its source");
assert(menu.dataset.track === "menu" && menu.loop, "menu bed should loop");

pageHidden = true;
documentListeners.get("visibilitychange")?.();
assert(menu.paused, "backgrounding the page should pause music");
pageHidden = false;
documentListeners.get("visibilitychange")?.();
assert(!menu.paused && menu.playCount >= 2, "returning to the page should resume the requested bed");

audio.setMusic(null);
assert(menu.getAttribute("src") === null && menu.loadCount > 0, "stopping music should release network resources");

console.log("✓ audio loads one requested track, pauses in background and releases old sources");
console.log("\nAudio tests passed.");
