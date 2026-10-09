import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { Provider } from 'react-redux';
import { beforeAll, describe, expect, it } from 'vitest';
import { server } from '../../../mocks/server';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { SettingsPanes } from './SettingsPanes';
import type { PaneId } from './panes';
import { createTestStore, setupI18n } from './testSupport';

beforeAll(setupI18n);

const preferences = {
  theme: 'onde',
  menuDefaults: {
    cutoffDaysBefore: 1,
    cutoffTime: '21:00',
    delivery: { available: false, note: { en: '', id: '' } },
  },
};

function renderPane(pane: PaneId) {
  return render(
    <Provider store={createTestStore()}>
      <AppThemeProvider>
        <MemoryRouter>
          <SettingsPanes
            pane={pane}
            devices={<p>Devices pane</p>}
            images={<p>Images pane</p>}
            chefs={<p>Chefs pane</p>}
            backup={<p>Backup pane</p>}
          />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('SettingsPanes', () => {
  it('lists all eight panes and marks the open one', async () => {
    server.use(http.get('*/api/seller/pickup-places', () => HttpResponse.json({ places: [] })));
    renderPane('pickup');
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(nav.querySelectorAll('a')).toHaveLength(8);
    expect(screen.getByRole('link', { name: /Pickup locations/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByText('No pickup places yet. Add the first one.')).toBeInTheDocument();
  });

  it('adds a pickup place and refreshes the list', async () => {
    const places: Array<Record<string, unknown>> = [];
    server.use(
      http.get('*/api/seller/pickup-places', () => HttpResponse.json({ places })),
      http.post('*/api/seller/pickup-places', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        const place = { id: 'p1', ...body };
        places.push(place);
        return HttpResponse.json({ place }, { status: 201 });
      }),
    );
    renderPane('pickup');
    fireEvent.click(await screen.findByRole('button', { name: 'Add a place' }));
    change('Place', 'Clayton');
    change('Directions (English)', 'Side gate');
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));
    expect(await screen.findByText('Clayton')).toBeInTheDocument();
  });

  it('warns when a deleted place was on the live menu', async () => {
    const place = {
      id: 'p1',
      place: 'Glenelg',
      directions: { en: 'Porch', id: 'Teras' },
      window: { start: '11:00', end: '13:00' },
    };
    server.use(
      http.get('*/api/seller/pickup-places', () => HttpResponse.json({ places: [place] })),
      http.delete('*/api/seller/pickup-places/p1', () =>
        HttpResponse.json({ ok: true, usedOnLiveMenu: true }),
      ),
    );
    renderPane('pickup');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    expect(
      await screen.findByText('Glenelg was on the live menu. The live menu no longer offers it.'),
    ).toBeInTheDocument();
  });

  it('saves the menu defaults', async () => {
    let body: unknown = null;
    server.use(
      http.get('*/api/seller/preferences', () => HttpResponse.json({ preferences })),
      http.put('*/api/seller/preferences', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ preferences });
      }),
    );
    renderPane('defaults');
    await screen.findByLabelText('Days before the cooking day');
    change('Days before the cooking day', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ menuDefaults: { cutoffDaysBefore: 2, cutoffTime: '21:00' } });
  });

  it('picks the kitchen colour theme', async () => {
    let body: unknown = null;
    server.use(
      http.get('*/api/seller/preferences', () => HttpResponse.json({ preferences })),
      http.put('*/api/seller/preferences', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ preferences: { ...preferences, theme: 'bali' } });
      }),
    );
    renderPane('look');
    fireEvent.click(await screen.findByRole('radio', { name: 'Bali' }));
    await waitFor(() => expect(body).toEqual({ theme: 'bali' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Bali' })).toHaveAttribute('aria-checked', 'true'),
    );
  });
});
