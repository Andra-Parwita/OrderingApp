import { renderHook, act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenu, usePastMenuPicture } from '../../api/menus';
import { DetailsStep } from './DetailsStep';
import type { MenuData } from './menuSlice';
import { PastDetail } from './PastMenusPanel';
import { menuWrapper, useMenuTestSetup } from './testKit';
import { useMenuWizard } from './useMenuWizard';

// Plan 064 stage 2: past menus show their picture, Start from copies it, and the picture slot can
// reuse a past menu's picture.

const request = vi.hoisted(() => vi.fn());
vi.mock('../../api/http', () => ({ request }));
vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('../../api/client', () => ({
  fetchPastWeek: () => new Promise(() => undefined),
}));
afterEach(cleanup);

const week = (id: string, pictureUrl?: string) => ({
  id,
  cookingDate: `2026-09-${id.slice(1).padStart(2, '0')}`,
  closedAt: '2026-09-20T00:00:00Z',
  hasOrders: true,
  totals: {
    orders: 1,
    cancelled: 0,
    incomeCents: 1000,
    paidCents: 0,
    unpaidCents: 1000,
    items: [],
  },
  ...(pictureUrl ? { pictureUrl } : {}),
});

function data(state: string, past: Array<ReturnType<typeof week>>): MenuData {
  return {
    view: {
      menu: {
        id: 'm1',
        state,
        cookingDate: '2026-10-17',
        cutoffAt: '2026-10-15T20:00:00+10:00',
        delivery: { available: false, note: { en: '', id: '' } },
        placeUses: [],
      },
      dishes: [],
      pickupPoints: [],
    },
    dishes: [],
    sets: [],
    places: [],
    chefs: [],
    prefs: {},
    past,
  } as unknown as MenuData;
}

describe('Past menus show their picture', () => {
  useMenuTestSetup();
  const show = (summary: ReturnType<typeof week>) => {
    const { wrap } = menuWrapper(data('finished', []));
    render(wrap(<PastDetail summary={summary} lang="en" onUse={() => undefined} />));
  };
  it('shows the picture when one was kept', () => {
    show(week('d1', '/images/a.jpg'));
    expect(screen.getByRole('img', { name: 'Menu picture' })).toHaveAttribute(
      'src',
      '/images/a.jpg',
    );
  });
  it('says so quietly when none was kept', () => {
    show(week('d2'));
    expect(screen.getByText('No picture kept')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Use a past menu picture', () => {
  useMenuTestSetup();
  it('lists the last 10 with pictures and asks for the one tapped', () => {
    const past = Array.from({ length: 12 }, (_, i) => week(`d${i + 1}`, `/images/${i + 1}.jpg`));
    past.splice(3, 0, week('d99'));
    const d = data('not_published', past);
    const { sent, wrap } = menuWrapper(d);
    render(wrap(<DetailsStep data={d} lang="en" />));
    fireEvent.click(screen.getByRole('button', { name: "Use a past menu's picture" }));
    const picks = screen.getAllByRole('button', { name: /^Menu of / });
    expect(picks).toHaveLength(10);
    fireEvent.click(picks[0]!);
    expect(sent).toEqual([{ kind: 'usePastPicture', pastMenuId: 'd1' }]);
  });
  it('is not offered when no past menu kept a picture', () => {
    const d = data('not_published', [week('d1')]);
    const { wrap } = menuWrapper(d);
    render(wrap(<DetailsStep data={d} lang="en" />));
    expect(screen.queryByRole('button', { name: "Use a past menu's picture" })).toBeNull();
  });
});

describe('Start from a past menu', () => {
  useMenuTestSetup();
  const input = (weekId: string) =>
    ({
      cookingDate: '2026-10-24',
      cutoffAt: '2026-10-22T20:00:00+10:00',
      source: { kind: 'past', weekId },
    }) as const;
  const startWith = (d: MenuData, weekId: string) => {
    const { sent, wrap } = menuWrapper(d);
    const { result } = renderHook(() => useMenuWizard(), {
      wrapper: ({ children }) => <>{wrap(children)}</>,
    });
    act(() => result.current.start(input(weekId)));
    return sent;
  };
  it('a new menu passes the past menu id to the create call', () => {
    const sent = startWith(data('finished', [week('d1', '/images/1.jpg')]), 'd1');
    expect(sent[0]).toEqual({
      kind: 'createMenu',
      cookingDate: '2026-10-24',
      pictureFromPastMenu: 'd1',
    });
  });
  it('passes nothing when that past menu kept no picture', () => {
    const sent = startWith(data('finished', [week('d1')]), 'd1');
    expect(sent[0]).toEqual({ kind: 'createMenu', cookingDate: '2026-10-24' });
  });
});

describe('client calls', () => {
  beforeEach(() => request.mockReset());
  it('createMenu sends pictureFromPastMenu in the body', async () => {
    await createMenu('2026-10-24', undefined, 'home', 'd1');
    expect(request).toHaveBeenCalledWith(
      '/api/seller/menus',
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: { cookingDate: '2026-10-24', pictureFromPastMenu: 'd1' },
      }),
    );
  });
  it('usePastMenuPicture PUTs the past menu id to the picture route', async () => {
    await usePastMenuPicture('d1', undefined, 'home');
    expect(request).toHaveBeenCalledWith(
      '/api/seller/menus/current/picture',
      expect.anything(),
      expect.objectContaining({ method: 'PUT', body: { pastMenuId: 'd1' } }),
    );
  });
});
