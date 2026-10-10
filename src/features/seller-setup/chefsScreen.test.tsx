import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore, mockStores } from '../../../mocks/handlers';
import { ChefsScreen } from './ChefsScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));

describe('ChefsScreen', () => {
  beforeEach(() => mockStores.reset());

  async function renderChefs() {
    renderWithStore(<ChefsScreen />, createTestStore());
    await screen.findByText('Chef Wati');
  }
  const names = async () => (await mockStore.listChefs()).map((chef) => chef.name);

  it('lists chefs with their items this week and the notes', async () => {
    await renderChefs();
    expect(screen.getByText('3 items this week')).toBeInTheDocument();
    expect(screen.getByText('Their items move to Onde Onde.')).toBeInTheDocument();
    expect(screen.queryByText('Invites for chefs come later.')).not.toBeInTheDocument();
  });

  it('adds a chef by name only, and refuses an empty name', async () => {
    await renderChefs();
    fireEvent.click(screen.getByRole('button', { name: 'Add chef' }));
    expect(screen.getByText('Write a name.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Chef name'), { target: { value: 'Chef Budi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add chef' }));
    expect(await screen.findByText('Chef Budi')).toBeInTheDocument();
    expect(screen.getByText('0 items this week')).toBeInTheDocument();
    expect(await names()).toContain('Chef Budi');
  });

  it('renames a chef', async () => {
    await renderChefs();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('New name for Chef Wati'), {
      target: { value: 'Chef Wati S' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Chef Wati S')).toBeInTheDocument();
    expect(await names()).toEqual(['Chef Wati S']);
  });

  it('deletes a chef only on the second tap', async () => {
    await renderChefs();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await names()).toEqual(['Chef Wati']);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    await waitFor(async () => expect(await names()).toEqual([]));
    expect(await screen.findByText('No chefs yet. Add the first one below.')).toBeInTheDocument();
  });

  it('invites a chef: the key is shown once, with the rule, Copy and a WhatsApp text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderChefs();
    expect(await screen.findByText('Not signed in on any device')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Invite to sign in' }));
    const box = await screen.findByRole('region', { name: 'Sign-in key for Chef Wati' });
    expect(
      within(box).getByText('Valid for 24 hours, works on up to 3 devices.'),
    ).toBeInTheDocument();
    const key = box.querySelector('code')?.textContent ?? '';
    expect(key).toMatch(/^DLV(-[A-Z0-9]{4}){4}$/);
    const link = within(box).getByRole('link', { name: 'Send on WhatsApp' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain(`Your ShaggyBobo's Order sign-in key: ${key}`);

    fireEvent.click(within(box).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(key));
    expect(await within(box).findByText('Copied')).toBeInTheDocument();

    fireEvent.click(within(box).getByRole('button', { name: 'Done' }));
    expect(document.body.textContent).not.toContain(key);
  });

  it('shows how many devices a chef is signed in on', async () => {
    const issued = await mockStores.auth.createKey(
      { role: 'chef', sellerId: 'seller-onde-onde', chefId: 'wati' },
      'invite',
    );
    // Straight in the store (a key, then a password): no browser session is involved.
    for (const n of ['1', '2']) {
      const started = await mockStores.auth.redeemKey(issued.key, `chef-dev-${n}-abcd`);
      if (!started.ok) throw new Error(started.error);
      await mockStores.auth.register(started.value.token, {
        kind: 'password',
        password: 'long enough password',
        deviceName: `Phone ${n}`,
      });
    }
    await renderChefs();
    expect(await screen.findByText('Signed in on 2 devices')).toBeInTheDocument();
  });

  it('invites in Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderWithStore(<ChefsScreen />, createTestStore());
    fireEvent.click(await screen.findByRole('button', { name: 'Undang untuk masuk' }));
    const box = await screen.findByRole('region', { name: 'Kunci masuk untuk Chef Wati' });
    expect(within(box).getByRole('button', { name: 'Selesai' })).toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderWithStore(<ChefsScreen />, createTestStore());
    expect(await screen.findByText('3 menu minggu ini')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah koki' })).toBeInTheDocument();
    expect(screen.getByText('Menu mereka pindah ke Onde Onde.')).toBeInTheDocument();
  });
});
