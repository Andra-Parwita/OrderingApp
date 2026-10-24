import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadSeller } from './launchKitchen';

describe('reloadSeller', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reloads to /seller?k=<slug> so the kitchen survives the reload', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    reloadSeller('onde-onde');
    expect(assign).toHaveBeenCalledWith('/seller?k=onde-onde');
  });
  it('reloads to plain /seller with no kitchen', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    reloadSeller(null);
    expect(assign).toHaveBeenCalledWith('/seller');
  });
});
