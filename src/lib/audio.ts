// Procedural space bed + UI cues. No asset downloads — Web Audio only.

type Cue = "select" | "focus" | "fly" | "tick";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let padGain: GainNode | null = null;
let voices: AudioScheduledSourceNode[] = [];
let padOsc: OscillatorNode | null = null;
let unlocked = false;
let muted = true;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Must run inside a user-gesture handler (click / key). */
export async function unlockAudio(): Promise<boolean> {
  const c = ensure();
  if (!c) return false;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }
  unlocked = c.state === "running";
  return unlocked;
}

function startPad() {
  const c = ensure();
  if (!c || !master || voices.length > 0 || muted || !unlocked) return;

  padGain = c.createGain();
  padGain.gain.value = 0;
  padGain.connect(master);

  // Mid-range drones — sub-55 Hz is silent on most laptop speakers
  const freqs = [110, 164.81, 220];
  for (let i = 0; i < freqs.length; i++) {
    const osc = c.createOscillator();
    osc.type = i === 0 ? "sine" : "triangle";
    osc.frequency.value = freqs[i];
    const g = c.createGain();
    g.gain.value = i === 0 ? 0.22 : 0.09;
    osc.connect(g);
    g.connect(padGain);
    osc.start();
    voices.push(osc);
    if (!padOsc) padOsc = osc;
  }

  // Slow amplitude breathe
  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.08;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.06;
  const lfoBias = c.createConstantSource();
  lfoBias.offset.value = 0.14;
  lfoBias.start();
  lfo.connect(lfoDepth);
  lfoDepth.connect(padGain.gain);
  lfoBias.connect(padGain.gain);
  lfo.start();
  voices.push(lfo, lfoBias);

  padGain.gain.setValueAtTime(0, c.currentTime);
  padGain.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.8);
}

function stopPad() {
  const c = ctx;
  if (padGain && c) {
    try {
      padGain.gain.cancelScheduledValues(c.currentTime);
      padGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.25);
    } catch {
      /* */
    }
  }
  const toStop = voices.slice();
  voices = [];
  padOsc = null;
  window.setTimeout(() => {
    for (const v of toStop) {
      try {
        v.stop();
      } catch {
        /* already stopped */
      }
    }
    if (padGain) {
      try {
        padGain.disconnect();
      } catch {
        /* */
      }
      padGain = null;
    }
  }, 280);
}

/** Turn ambient on — call from click handler. */
export async function enableAudio(): Promise<void> {
  muted = false;
  const ok = await unlockAudio();
  if (!ok) return;
  startPad();
}

/** Mute ambient + cues. */
export function disableAudio(): void {
  muted = true;
  stopPad();
}

export function setAudioMuted(next: boolean) {
  if (next) disableAudio();
  else void enableAudio();
}

export function isAudioMuted() {
  return muted;
}

export function armAudioUnlock() {
  const once = () => {
    void unlockAudio();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { passive: true });
  window.addEventListener("keydown", once);
}

/** Short blip — selection / focus / fly. */
export function playCue(kind: Cue) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();

  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(master);

  const table: Record<Cue, { f: number; dur: number; type: OscillatorType; vol: number }> = {
    select: { f: 880, dur: 0.12, type: "sine", vol: 0.18 },
    focus: { f: 523, dur: 0.18, type: "triangle", vol: 0.14 },
    fly: { f: 330, dur: 0.28, type: "sine", vol: 0.16 },
    tick: { f: 1200, dur: 0.05, type: "sine", vol: 0.1 },
  };
  const p = table[kind];
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.f, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, p.f * 0.65), now + p.dur);
  g.gain.setValueAtTime(p.vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
  osc.start(now);
  osc.stop(now + p.dur + 0.02);
}

/** Map altitude / speed into a soft pitch bend on the pad (sat follow). */
export function modulateFromTelemetry(altitudeKm: number, speedKmS: number) {
  if (muted || !padOsc || !ctx) return;
  const target = 98 + Math.min(50, altitudeKm / 80) + speedKmS * 2.2;
  padOsc.frequency.setTargetAtTime(target, ctx.currentTime, 0.8);
}
