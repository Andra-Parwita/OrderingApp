import { useSyncExternalStore } from 'react';

// Plan 021 stage 3: a short, quiet two-note tone for a new order. Web Audio, no audio file. The
// switch is per device (localStorage). iOS only lets audio start after a tap, so the first tap
// anywhere (or the switch itself) unlocks the audio context.

const KEY = 'newOrderSound';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false; // storage blocked: off
  }
}

let on = read();
let ctx: AudioContext | null = null;

/** Creates (or resumes) the audio context; call it from a tap. */
function unlock(): void {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return;
  ctx ??= new window.AudioContext();
  void ctx.resume();
}

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      if (on) unlock();
    },
    { once: true, capture: true },
  );
}

export function playChime(): void {
  if (!on || !ctx) return; // shortcut: before the first tap there is no sound, not even when on
  void ctx.resume();
  const start = ctx.currentTime;
  [660, 880].forEach((hz, i) => {
    if (!ctx) return;
    const at = start + i * 0.14;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.3);
  });
}

/** Called from the switch (a tap): remembers the choice, unlocks the audio and plays a sample. */
export function setSoundPreference(next: boolean): void {
  on = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // storage blocked: the choice lasts until the page closes
  }
  if (next) {
    unlock();
    playChime();
  }
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useSoundPreference(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );
}
