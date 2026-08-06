export type SoundId = "bet" | "close" | "spin" | "tick" | "settle" | "pay" | "error" | "bonus" | "level";

let context: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
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
