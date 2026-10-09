"use client";

// Sound for the French course, all in the browser: the system's French voice reads sentences
// (speechSynthesis), speech recognition listens (where the browser has it), and tiny synthesized
// sounds say right and wrong. Nothing to download, nothing sent anywhere by us.

const LANG = "fr-FR";

let chosen: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr"));
  if (!voices.length) return null;
  // Natural-sounding voices first, French from France before Canadian or Swiss.
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang === LANG ? 4 : 0) + (/google|natural|neural|premium|enhanced/i.test(v.name) ? 3 : 0) + (/amélie|amelie|thomas|audrey|marie|denise|henri/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

/** Resolves with whether a French voice exists (voices load late in some browsers). */
export function frenchVoiceReady(): Promise<boolean> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve(false);
  chosen = pickVoice();
  if (chosen) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      chosen = pickVoice();
      resolve(!!chosen);
    };
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Read French aloud. `slow` for the turtle button. Resolves when done (or right away without a voice). */
export function say(text: string, opts: { slow?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  if (chosen === undefined) chosen = pickVoice();
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, ""));
    u.lang = chosen?.lang ?? LANG;
    if (chosen) u.voice = chosen;
    u.rate = opts.slow ? 0.62 : 0.92;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    // Some browsers never fire onend for very short texts.
    setTimeout(resolve, 600 + text.length * (opts.slow ? 130 : 80));
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* -------------------------------------------------------------------------------------------
   Listening to the student
   ------------------------------------------------------------------------------------------- */

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canRecognize = () => recognitionClass() !== null;

/** Listen once in French. Resolves with what was understood (a few guesses), or [] for nothing. */
export function listenOnce(): { result: Promise<string[]>; stop: () => void } {
  const Rec = recognitionClass();
  if (!Rec) return { result: Promise.resolve([]), stop: () => {} };
  const rec = new Rec();
  rec.lang = LANG;
  rec.interimResults = false;
  rec.maxAlternatives = 4;
  const result = new Promise<string[]>((resolve) => {
    let heard: string[] = [];
    rec.onresult = (e) => {
      const first = e.results[0];
      heard = Array.from({ length: first.length }, (_, i) => first[i].transcript);
    };
    rec.onerror = () => resolve(heard);
    rec.onend = () => resolve(heard);
  });
  try {
    rec.start();
  } catch {
    return { result: Promise.resolve([]), stop: () => {} };
  }
  return { result, stop: () => rec.stop() };
}

/* -------------------------------------------------------------------------------------------
   Little sounds
   ------------------------------------------------------------------------------------------- */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, at: number, length: number, type: OscillatorType, volume: number) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = a.currentTime + at;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export const sounds = {
  /** A bright two-note chime. */
  right() {
    tone(784, 0, 0.16, "sine", 0.18);
    tone(1175, 0.09, 0.26, "sine", 0.16);
  },
  /** A soft low bump (not a buzzer). */
  wrong() {
    tone(220, 0, 0.22, "triangle", 0.16);
    tone(185, 0.08, 0.26, "triangle", 0.12);
  },
  /** A tap on a tile. */
  tap() {
    tone(660, 0, 0.05, "sine", 0.06);
  },
  /** The end of a lesson: a little rising arpeggio. */
  done() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.32, "sine", 0.14));
  },
};

/* -------------------------------------------------------------------------------------------
   The student's switches (kept in this browser)
   ------------------------------------------------------------------------------------------- */

const KEY = { sound: "blob-fr-sound", speakOff: "blob-fr-speak-off", listenOff: "blob-fr-listen-off" };

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export const prefs = {
  soundOn: () => read(KEY.sound) !== "off",
  setSound: (on: boolean) => write(KEY.sound, on ? null : "off"),
  /** "Can't speak now" / "Can't listen now" turn those exercises off for an hour. */
  speakingOff: () => Number(read(KEY.speakOff) ?? 0) > Date.now(),
  listeningOff: () => Number(read(KEY.listenOff) ?? 0) > Date.now(),
  pauseSpeaking: () => write(KEY.speakOff, String(Date.now() + 3600_000)),
  pauseListening: () => write(KEY.listenOff, String(Date.now() + 3600_000)),
};
