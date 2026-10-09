import { fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { ChefsScreen } from './ChefsScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
afterEach(() => i18n.changeLanguage('en'));

describe('ChefsScreen', () => {
  beforeEach(() => mockStore.reset());

  async function renderChefs() {
    renderWithStore(<ChefsScreen />, createTestStore());
    await screen.findByText('Chef Wati');
  }
  const names = () => mockStore.listChefs().map((chef) => chef.name);

  it('lists chefs with their items this week and the notes', async () => {
    await renderChefs();
    expect(screen.getByText('3 items this week')).toBeInTheDocument();
    expect(screen.getByText('Their items move to Onde Onde.')).toBeInTheDocument();
    expect(screen.getByText('Invites for chefs come later.')).toBeInTheDocument();
  });

  it('adds a chef by name only, and refuses an empty name', async () => {
    await renderChefs();
    fireEvent.click(screen.getByRole('button', { name: 'Add chef' }));
    expect(screen.getByText('Write a name.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Chef name'), { target: { value: 'Chef Budi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add chef' }));
    expect(await screen.findByText('Chef Budi')).toBeInTheDocument();
    expect(screen.getByText('0 items this week')).toBeInTheDocument();
    expect(names()).toContain('Chef Budi');
  });

  it('renames a chef', async () => {
    await renderChefs();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('New name for Chef Wati'), {
      target: { value: 'Chef Wati S' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Chef Wati S')).toBeInTheDocument();
    expect(names()).toEqual(['Chef Wati S']);
  });

  it('deletes a chef only on the second tap', async () => {
    await renderChefs();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(names()).toEqual(['Chef Wati']);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    await waitFor(() => expect(names()).toEqual([]));
    expect(await screen.findByText('No chefs yet. Add the first one below.')).toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    renderWithStore(<ChefsScreen />, createTestStore());
    expect(await screen.findByText('3 menu minggu ini')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah koki' })).toBeInTheDocument();
    expect(screen.getByText('Menu mereka pindah ke Onde Onde.')).toBeInTheDocument();
  });
});
