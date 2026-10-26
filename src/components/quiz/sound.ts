"use client";

// The quiz's music and sounds, played with the Web Audio API (no files to load): a bouncy tune
// in the lobby, quicker music while people answer, ticks for the last seconds, a gong when time
// is up, a plop when someone joins, a drumroll and a fanfare for the podium. Browsers only allow
// sound after a tap or click, so the first one unlocks it.

type Loop = "lobby" | "answer" | null;

const MUTE_KEY = "blob-quiz-mute";

// Notes as semitones from A4 (440 Hz).
const hz = (semi: number) => 440 * Math.pow(2, semi / 12);

// A cheerful pentatonic tune: [semitone, beats]; null rests.
const LOBBY: [number | null, number][] = [
  [3, 1], [7, 1], [10, 1], [7, 1], [12, 1], [10, 1], [7, 2],
  [5, 1], [8, 1], [12, 1], [8, 1], [15, 1], [12, 1], [8, 2],
  [3, 1], [7, 1], [10, 1], [15, 1], [14, 1], [10, 1], [7, 1], [10, 1],
  [12, 1], [10, 1], [7, 1], [5, 1], [3, 2], [null, 2],
];
const LOBBY_BASS = [-21, -16, -21, -14];
const ANSWER: [number | null, number][] = [
  [0, 0.5], [7, 0.5], [12, 0.5], [7, 0.5], [3, 0.5], [7, 0.5], [12, 0.5], [7, 0.5],
  [-2, 0.5], [5, 0.5], [10, 0.5], [5, 0.5], [2, 0.5], [5, 0.5], [10, 0.5], [5, 0.5],
];

class QuizSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private loop: Loop = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private nextAt = 0;
  private step = 0;
  muted = false;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {}
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** Call from a click or tap: browsers start audio only then. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {}
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    this.listeners.forEach((fn) => fn());
  }

  private note(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; bend?: number; attack?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, at);
    if (opts.bend) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.bend), at + dur);
    const peak = opts.gain ?? 0.25;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** A soft mallet: a sine with a quick overtone. */
  private mallet(semi: number, at: number, dur: number, gain = 0.22) {
    this.note(hz(semi), at, dur, { gain });
    this.note(hz(semi + 24), at, dur * 0.25, { gain: gain * 0.18, type: "triangle" });
  }

  private noise(at: number, dur: number, gain = 0.2, filter = 1800) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.master);
    src.start(at);
  }

  // Loops --------------------------------------------------------------------------------------

  play(loop: Loop) {
    if (loop === this.loop) return;
    this.loop = loop;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
    if (!loop || !this.ctx) return;
    this.step = 0;
    this.nextAt = this.ctx.currentTime + 0.1;
    this.schedule();
  }

  private schedule = () => {
    const ctx = this.ctx;
    if (!ctx || !this.loop) return;
    const tune = this.loop === "lobby" ? LOBBY : ANSWER;
    const beat = this.loop === "lobby" ? 60 / 132 : 60 / 150;
    // Plan a little ahead, so timers that run late don't stumble.
    while (this.nextAt < ctx.currentTime + 0.4) {
      const [semi, beats] = tune[this.step % tune.length];
      if (semi !== null) this.mallet(semi, this.nextAt, Math.min(0.6, beats * beat * 1.4), this.loop === "lobby" ? 0.16 : 0.12);
      const bar = this.loop === "lobby" ? 8 : 4;
      const pos = tune.slice(0, this.step % tune.length).reduce((s, [, b]) => s + b, 0);
      if (pos % bar === 0) {
        const bassNote = this.loop === "lobby" ? LOBBY_BASS[Math.floor(pos / bar) % LOBBY_BASS.length] : -24 + (this.step % 16 < 8 ? 0 : -2);
        this.note(hz(bassNote), this.nextAt, beat * 1.8, { type: "triangle", gain: 0.18 });
      }
      if (this.loop === "answer" && this.step % 2 === 0) this.noise(this.nextAt, 0.04, 0.05, 6000);
      this.nextAt += beats * beat;
      this.step++;
    }
    this.loopTimer = setTimeout(this.schedule, 120);
  };

  // Cues ---------------------------------------------------------------------------------------

  private at() {
    return this.ctx ? this.ctx.currentTime + 0.01 : 0;
  }

  plop() {
    if (!this.ctx) return;
    const t = this.at();
    this.note(hz(-5 + Math.floor(Math.random() * 7)), t, 0.18, { gain: 0.3, bend: 2.2 });
  }

  tick(last = false) {
    if (!this.ctx) return;
    const t = this.at();
    this.note(last ? 1320 : 990, t, 0.07, { type: "square", gain: 0.06 });
  }

  gong() {
    if (!this.ctx) return;
    const t = this.at();
    for (const [f, g] of [[110, 0.3], [220, 0.12], [331, 0.08], [497, 0.05]] as const) this.note(f, t, 2.2, { gain: g, attack: 0.004 });
  }

  chime() {
    if (!this.ctx) return;
    const t = this.at();
    [0, 4, 7, 12].forEach((s, i) => this.mallet(s + 3, t + i * 0.07, 0.6, 0.18));
  }

  tap() {
    if (!this.ctx) return;
    this.note(660, this.at(), 0.06, { gain: 0.12, bend: 1.3 });
  }

  right() {
    if (!this.ctx) return;
    const t = this.at();
    [0, 4, 7, 12, 16].forEach((s, i) => this.mallet(s + 3, t + i * 0.06, 0.5, 0.2));
  }

  wrong() {
    if (!this.ctx) return;
    const t = this.at();
    this.note(196, t, 0.25, { type: "sawtooth", gain: 0.08, bend: 0.8 });
    this.note(147, t + 0.18, 0.35, { type: "sawtooth", gain: 0.08, bend: 0.8 });
  }

  drumroll(seconds = 2.4) {
    if (!this.ctx) return;
    const t = this.at();
    for (let i = 0; i < seconds * 22; i++) this.noise(t + i / 22, 0.05, 0.08 + (i / (seconds * 22)) * 0.12, 900);
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.at();
    const notes: [number, number, number][] = [
      [3, 0, 0.18], [3, 0.2, 0.12], [3, 0.34, 0.12], [8, 0.5, 0.5], [7, 1.05, 0.18], [8, 1.25, 0.8],
    ];
    for (const [s, at, d] of notes) {
      this.note(hz(s), t + at, d + 0.2, { type: "sawtooth", gain: 0.07 });
      this.note(hz(s + 7), t + at, d + 0.2, { type: "triangle", gain: 0.06 });
    }
    this.noise(t + 1.25, 0.6, 0.1, 5000);
  }

  stopAll() {
    this.play(null);
  }
}

let shared: QuizSound | null = null;

/** The one sound engine of the page. */
export function quizSound(): QuizSound {
  shared ??= new QuizSound();
  return shared;
}
