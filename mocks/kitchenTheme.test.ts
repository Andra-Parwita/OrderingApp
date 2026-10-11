// Plan 024 stage 1: the Worker puts the kitchen's current theme in the page (read fresh each time).
import { describe, expect, it } from 'vitest';
import { kitchenPageFor } from '../worker/api/kitchenPage';
import { useWorld } from './impl';

describe('kitchen page theme', () => {
  const create = useWorld('kitchenTheme');

  it('carries the current theme and its browser-bar colour, and follows a change', async () => {
    const world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
    const first = await kitchenPageFor(world.repo, '/onde-onde');
    expect(first?.theme).toBe('onde');
    await world.db.stmt("UPDATE kitchen_settings SET theme = 'bali'").run();
    const page = await kitchenPageFor(world.repo, '/onde-onde/basket');
    expect(page?.theme).toBe('bali');
    expect(page?.head).toContain('<meta name="theme-color" content="#');
    expect(await kitchenPageFor(world.repo, '/nobody-here')).toBeNull();
    expect((await kitchenPageFor(world.repo, '/seller/orders'))?.theme).toBeUndefined();
  });
});
