import { fireEvent, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStores } from '../../../mocks/handlers';
import { ChefsScreen } from './ChefsScreen';
import { TeamScreen } from './TeamScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 061 stages 3 and 8: a typed cook name and a typed invite survive a reload; no key is stored.

const createInvite = vi.fn(() =>
  Promise.resolve({ ok: true, data: { key: 'DLV-AAAA-BBBB', expiresAt: '', maxDevices: 1 } }),
);
vi.mock('../../api/auth', () => ({
  fetchTeam: () => Promise.resolve({ ok: true, data: { members: [] } }),
  removeTeamMember: vi.fn(),
  createInvite: () => createInvite(),
}));

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));
beforeEach(() => {
  void mockStores.reset();
  localStorage.clear();
});

describe('chefs modal draft', () => {
  it('restores the new chef name after closing, and clears it when added', async () => {
    const first = renderWithStore(<ChefsScreen />, createTestStore());
    await screen.findByText('Chef Wati');
    fireEvent.change(screen.getByLabelText('Chef name'), { target: { value: 'Chef Bud' } });
    first.unmount();
    renderWithStore(<ChefsScreen />, createTestStore());
    await screen.findByText('Chef Wati');
    expect(screen.getByLabelText<HTMLInputElement>('Chef name').value).toBe('Chef Bud');
    expect(screen.getByText('Restored what you typed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add chef' }));
    expect(screen.getByLabelText<HTMLInputElement>('Chef name').value).toBe('');
    expect(Object.keys(localStorage).filter((k) => k.startsWith('draft:'))).toEqual([]);
  });
});

describe('invite form draft', () => {
  it('restores name and role, and never stores the key or the link', async () => {
    const first = renderWithStore(<TeamScreen />, createTestStore());
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Tia' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Helper' }));
    first.unmount();
    renderWithStore(<TeamScreen />, createTestStore());
    expect((await screen.findByLabelText<HTMLInputElement>('Name')).value).toBe('Tia');
    expect(screen.getByRole('radio', { name: 'Helper' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Make invite' }));
    const box = await screen.findByRole('region', { name: 'Invite for Tia' });
    fireEvent.change(within(box).getByRole('textbox'), {
      target: { value: 'edited DLV-AAAA-BBBB' },
    });
    // Cleared on success; nothing with the key (or the word "key") is in storage at any point.
    expect(Object.keys(localStorage).filter((k) => k.startsWith('draft:'))).toEqual([]);
    const all = JSON.stringify({ ...localStorage });
    expect(all).not.toContain('DLV-AAAA-BBBB');
    expect(all).not.toContain('#key=');
  });
});
