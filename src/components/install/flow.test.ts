import { describe, expect, it } from 'vitest';
import type { Environment } from './detect';
import {
  CLOSED,
  canGoBack,
  entryFor,
  flowReducer,
  stepOf,
  type FlowEvent,
  type FlowState,
} from './flow';

const env = (patch: Partial<Environment>): Environment => ({
  platform: 'ios',
  inApp: false,
  inAppName: null,
  safari: true,
  installed: false,
  pushSupported: false,
  permission: 'default',
  ...patch,
});

function run(events: Array<FlowEvent>, from: FlowState = CLOSED): FlowState {
  return events.reduce(flowReducer, from);
}

describe('the iPhone guide', () => {
  it('walks ask, four steps and the open screen, one at a time', () => {
    const seen = [flowReducer(CLOSED, { type: 'open', screen: 'ios-ask' })];
    for (let i = 0; i < 5; i += 1) seen.push(flowReducer(seen[i] ?? CLOSED, { type: 'next' }));
    expect(seen.map((state) => state.screen)).toEqual([
      'ios-ask',
      'ios-step-1',
      'ios-step-2',
      'ios-step-3',
      'ios-step-4',
      'ios-open-from-home',
    ]);
  });

  it('stops at the last screen and at the first', () => {
    const last = run([{ type: 'open', screen: 'ios-open-from-home' }, { type: 'next' }]);
    expect(last.screen).toBe('ios-open-from-home');
    const first = run([{ type: 'open', screen: 'ios-ask' }, { type: 'back' }]);
    expect(first.screen).toBe('ios-ask');
  });

  it('Back goes to the step before', () => {
    const state = run([{ type: 'open', screen: 'ios-step-3' }, { type: 'back' }]);
    expect(state.screen).toBe('ios-step-2');
  });

  it('the close button closes from any screen', () => {
    for (const screen of ['ios-ask', 'ios-step-2', 'ios-open-from-home'] as const) {
      expect(run([{ type: 'open', screen }, { type: 'close' }]).screen).toBeNull();
    }
  });

  it('other iPhone browsers start at Share and count three steps', () => {
    let state = run([{ type: 'open', screen: 'ios-ask', variant: 'other' }, { type: 'next' }]);
    expect(state.screen).toBe('ios-step-2');
    expect(stepOf('ios-step-2', 'other')).toEqual({ n: 1, total: 3 });
    expect(stepOf('ios-step-4', 'other')).toEqual({ n: 3, total: 3 });
    state = run([{ type: 'next' }, { type: 'next' }, { type: 'next' }], state);
    expect(state.screen).toBe('ios-open-from-home');
  });

  it('Safari counts four steps, with no Back on the first', () => {
    expect(stepOf('ios-step-1', 'safari')).toEqual({ n: 1, total: 4 });
    expect(stepOf('ios-ask', 'safari')).toBeNull();
    expect(canGoBack('ios-step-1', 'safari')).toBe(false);
    expect(canGoBack('ios-step-3', 'safari')).toBe(true);
    expect(canGoBack('ios-step-2', 'other')).toBe(false);
    expect(canGoBack('ios-open-from-home', 'safari')).toBe(false);
  });
});

describe('hints and busy', () => {
  it('a new screen clears the hint', () => {
    const state = run([
      { type: 'open', screen: 'notify-blocked' },
      { type: 'hint', hint: 'still-blocked' },
      { type: 'show', screen: 'notify-off' },
    ]);
    expect(state.hint).toBeNull();
    expect(state.screen).toBe('notify-off');
  });

  it('busy is kept until the screen changes', () => {
    const state = run([
      { type: 'open', screen: 'notify-off' },
      { type: 'busy', busy: true },
    ]);
    expect(state.busy).toBe(true);
    expect(flowReducer(state, { type: 'show', screen: 'not-set-up' }).busy).toBe(false);
  });
});

describe('entryFor: what "Turn on updates" shows first (spec 6.1)', () => {
  it('iPhone Safari, not installed: the guide', () => {
    expect(entryFor(env({}))).toMatchObject({ screen: 'ios-ask', variant: 'safari' });
  });
  it('iPhone Chrome: the guide with Share first', () => {
    expect(entryFor(env({ safari: false }))).toMatchObject({
      screen: 'ios-ask',
      variant: 'other',
    });
  });
  it('iPhone inside WhatsApp: open in Safari', () => {
    expect(entryFor(env({ inApp: true, safari: false })).screen).toBe('ios-inside-whatsapp');
  });
  it('iPhone installed: the Last step screen, and nothing is asked yet', () => {
    expect(entryFor(env({ installed: true, pushSupported: true }))).toMatchObject({
      screen: 'notify-off',
      immediate: false,
    });
  });
  it('iPhone installed with permission denied: the blocked screen', () => {
    expect(
      entryFor(env({ installed: true, pushSupported: true, permission: 'denied' })).screen,
    ).toBe('notify-blocked');
  });
  it('Android Chrome asks straight away (in the same tap)', () => {
    expect(entryFor(env({ platform: 'android', safari: false, pushSupported: true }))).toEqual({
      screen: 'android-allow',
      immediate: true,
      variant: 'other',
    });
  });
  it('Android inside WhatsApp: open in Chrome', () => {
    expect(
      entryFor(env({ platform: 'android', safari: false, inApp: true, pushSupported: true }))
        .screen,
    ).toBe('android-inside-whatsapp');
  });
  it('desktop asks straight away with no sheet of its own', () => {
    expect(
      entryFor(env({ platform: 'desktop', safari: false, pushSupported: true })),
    ).toMatchObject({ screen: null, immediate: true });
  });
  it('where push cannot work: the generic screen with Skip', () => {
    expect(entryFor(env({ platform: 'desktop', safari: false })).screen).toBe('unsupported');
  });
});
