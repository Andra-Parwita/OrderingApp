import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStores } from '../../../mocks/handlers';
import { TeamScreen } from './TeamScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));

const wati = {
  accountId: 'p1',
  displayName: 'Wati',
  role: 'chef',
  chefId: 'wati',
  chefName: 'Chef Wati',
  devices: 1,
  createdAt: '2026-10-10T00:00:00Z',
};
const owner = {
  accountId: 'p0',
  displayName: 'Dewi',
  role: 'owner',
  devices: 1,
  createdAt: '',
  you: true,
};
let members: Array<unknown> = [];
const fetchTeam = vi.fn(() => Promise.resolve({ ok: true, data: { members } }));
const removeTeamMember = vi.fn((id: string) => {
  members = members.filter((m) => (m as { accountId: string }).accountId !== id);
  return Promise.resolve({ ok: true, data: { ok: true } });
});
const createInvite = vi.fn<(input: unknown) => Promise<unknown>>(() =>
  Promise.resolve({ ok: true, data: { key: 'DLV-AAAA-BBBB', expiresAt: '', maxDevices: 1 } }),
);
vi.mock('../../api/auth', () => ({
  fetchTeam: () => fetchTeam(),
  removeTeamMember: (id: string) => removeTeamMember(id),
  createInvite: (input: unknown) => createInvite(input),
}));

describe('TeamScreen', () => {
  beforeEach(() => {
    void mockStores.reset();
    members = [owner, wati];
    vi.clearAllMocks();
  });

  it('lists members with role, cook and devices, and the cooks below', async () => {
    renderWithStore(<TeamScreen />, createTestStore());
    const list = await screen.findByRole('list', { name: 'Team' });
    expect(within(list).getByText('Wati')).toBeInTheDocument();
    expect(within(list).getByText(/Chef · cooks as Chef Wati/)).toBeInTheDocument();
    expect(within(list).getAllByText('Signed in on 1 device')).toHaveLength(2);
    expect(within(list).getByText('Dewi (you)')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Add chef' })).toBeInTheDocument();
  });

  it('invites a chef: the link with the key and the key alone can be copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithStore(<TeamScreen />, createTestStore());
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make invite' }));
    const box = await screen.findByRole('region', { name: 'Invite for Rina' });
    expect(
      within(box).getByText('Works once, on one device, within 24 hours.'),
    ).toBeInTheDocument();
    const key = box.querySelector('code')?.textContent ?? '';
    fireEvent.click(within(box).getByRole('button', { name: 'Copy link with key' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const link = String(writeText.mock.calls[0]?.[0]);
    expect(link).toMatch(/^https:\/\/[^/]+\/seller\/setup\?kitchen=[a-z0-9-]+#key=/);
    expect(decodeURIComponent(link)).toContain(`#key=${key}`);
    fireEvent.click(within(box).getByRole('button', { name: 'Copy key' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(key));
    fireEvent.click(within(box).getByRole('button', { name: 'Done' }));
    expect(document.body.textContent).not.toContain(key);
  });

  it('removes a member on the second tap and offers to reassign their dishes', async () => {
    renderWithStore(<TeamScreen />, createTestStore());
    await screen.findByText('Wati');
    await screen.findByText('3 items this week');
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to remove' }));
    expect(await screen.findByRole('link', { name: 'Open the menu' })).toBeInTheDocument();
    expect(removeTeamMember).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen.queryByText('Wati')).not.toBeInTheDocument());
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderWithStore(<TeamScreen />, createTestStore());
    expect(await screen.findByRole('button', { name: 'Buat undangan' })).toBeInTheDocument();
  });
});
