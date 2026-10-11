import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
  vi.resetModules();
  return import('./textSize');
};
const rootSize = () => document.documentElement.style.fontSize;

describe('text size', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.fontSize = '';
  });
  afterEach(() => vi.restoreAllMocks());

  it('defaults to Normal', async () => {
    const m = await load();
    expect(m.readTextSize()).toBe('normal');
    expect(rootSize()).toBe('100%');
  });

  it('stores and applies the choice, and applies a saved one at start-up', async () => {
    const m = await load();
    m.setTextSize('larger');
    expect(localStorage.getItem('textSize')).toBe('larger');
    expect(rootSize()).toBe('112.5%');
    document.documentElement.style.fontSize = '';
    await load();
    expect(rootSize()).toBe('112.5%');
  });

  it('applies Smaller', async () => {
    const m = await load();
    m.setTextSize('smaller');
    expect(rootSize()).toBe('87.5%');
  });

  it('falls back to Normal when storage fails, and still applies the choice', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const m = await load();
    expect(m.readTextSize()).toBe('normal');
    m.setTextSize('larger');
    expect(rootSize()).toBe('112.5%');
  });

  it('ignores a junk saved value', async () => {
    localStorage.setItem('textSize', 'huge');
    const m = await load();
    expect(m.readTextSize()).toBe('normal');
  });
});
