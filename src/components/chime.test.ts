import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Plan 021 stage 3: the sound switch is per device and off by default; nothing plays while off.

function fakeAudio() {
  const oscillators: Array<{ start: ReturnType<typeof vi.fn> }> = [];
  class FakeContext {
    currentTime = 0;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    createOscillator() {
      const osc = {
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  return oscillators;
}

async function load() {
  vi.resetModules();
  return import('./chime');
}

describe('chime', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('is off by default and plays nothing', async () => {
    const oscillators = fakeAudio();
    const { playChime } = await load();
    playChime();
    expect(oscillators).toHaveLength(0);
  });

  it('remembers the switch on this device and plays once it is on', async () => {
    const oscillators = fakeAudio();
    const first = await load();
    first.setSoundPreference(true); // the tap: unlocks and plays a sample
    expect(localStorage.getItem('newOrderSound')).toBe('1');
    expect(oscillators).toHaveLength(2);
    first.playChime();
    expect(oscillators).toHaveLength(4);

    const again = await load(); // a new page load reads it back
    again.setSoundPreference(false);
    oscillators.length = 0;
    again.playChime();
    expect(oscillators).toHaveLength(0);
    expect(localStorage.getItem('newOrderSound')).toBe('0');
  });
});
