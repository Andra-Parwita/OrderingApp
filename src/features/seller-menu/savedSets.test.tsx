import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { SavedSetsScreen } from './SavedSetsScreen';
import { emptyMenu, orderThenDraft, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);
beforeEach(() => {
  mockStore.reset();
  mockStore.setWeek({ status: 'draft' });
});

function renderSets() {
  const onBack = vi.fn();
  const onUsed = vi.fn();
  renderWithStore(<SavedSetsScreen onBack={onBack} onUsed={onUsed} />);
  return { onBack, onUsed };
}
const unwrap = <T,>(result: { ok: boolean; value?: T }): T => {
  if (!result.ok) throw new Error('store refused');
  return result.value as T;
};
/** Saves the current menu as a set, then gives the week a single different item. */
function saveSetThenChangeWeek(name: string) {
  unwrap(mockStore.saveSet(name));
}

describe('SavedSetsScreen', () => {
  it('lists the sets with their item and image counts', async () => {
    saveSetThenChangeWeek('Soto week');
    renderSets();
    const list = await screen.findByRole('list', { name: 'Saved sets' });
    const card = within(list).getByRole('listitem');
    expect(card).toHaveTextContent('Soto week');
    expect(card).toHaveTextContent('6 items · 5 images');
    expect(screen.getByText('1 of 5 sets')).toBeInTheDocument();
  });

  it('asks before replacing a week that has items, then replaces them', async () => {
    saveSetThenChangeWeek('Soto week');
    mockStore.removeItem('pesmol');
    const { onUsed } = renderSets();
    fireEvent.click(await screen.findByRole('button', { name: 'Use this set' }));
    expect(screen.getByText("Replace this week's 5 items?")).toBeInTheDocument();
    expect(mockStore.getSellerMenu().items).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText("Replace this week's 5 items?")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use this set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace items' }));
    await waitFor(() => expect(onUsed).toHaveBeenCalled());
    expect(mockStore.getSellerMenu().items).toHaveLength(6);
  });

  it('uses a set straight away when the week is empty', async () => {
    saveSetThenChangeWeek('Soto week');
    emptyMenu();
    const { onUsed } = renderSets();
    fireEvent.click(await screen.findByRole('button', { name: 'Use this set' }));
    await waitFor(() => expect(onUsed).toHaveBeenCalled());
    expect(mockStore.getSellerMenu().items).toHaveLength(6);
  });

  it('falls back to onBack when no onUsed is given', async () => {
    saveSetThenChangeWeek('Soto week');
    emptyMenu();
    const onBack = vi.fn();
    renderWithStore(<SavedSetsScreen onBack={onBack} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use this set' }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
  });

  it('explains a published week in plain words', async () => {
    saveSetThenChangeWeek('Soto week');
    mockStore.setWeek({ status: 'published' });
    renderSets();
    fireEvent.click(await screen.findByRole('button', { name: 'Use this set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This menu is published, so its items can't be replaced. Unpublish it first.",
    );
  });

  it('explains items that already have orders', async () => {
    saveSetThenChangeWeek('Soto week');
    mockStore.setWeek({ status: 'published' });
    orderThenDraft('pesmol');
    renderSets();
    fireEvent.click(await screen.findByRole('button', { name: 'Use this set' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace items' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Some items already have orders, so they can't be replaced. Mark them sold out instead.",
    );
  });

  it('saves this week as a set and asks for a name first', async () => {
    renderSets();
    await screen.findByRole('heading', { name: 'Save this week as a set' });
    fireEvent.click(screen.getByRole('button', { name: 'Save set' }));
    expect(await screen.findByText('Give the set a name.')).toBeInTheDocument();
    expect(mockStore.listSets()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Set name'), { target: { value: 'Rendang week' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save set' }));
    expect(await screen.findByText('Set saved')).toBeInTheDocument();
    expect(mockStore.listSets().map((set) => set.name)).toEqual(['Rendang week']);
    expect(await screen.findByText('1 of 5 sets')).toBeInTheDocument();
  });

  it('at 5 sets asks which one to replace', async () => {
    for (const name of ['A', 'B', 'C', 'D', 'E']) saveSetThenChangeWeek(`Set ${name}`);
    renderSets();
    expect(await screen.findByText('You have 5 sets. Pick one to replace.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save set' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Set name'), { target: { value: 'New week' } });
    fireEvent.click(screen.getByRole('button', { name: 'Replace Set C' }));
    expect(await screen.findByText('Set saved')).toBeInTheDocument();
    const names = mockStore.listSets().map((set) => set.name);
    expect(names).toHaveLength(5);
    expect(names).toContain('New week');
    expect(names).not.toContain('Set C');
  });

  it('renames a set', async () => {
    saveSetThenChangeWeek('Soto week');
    renderSets();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Soto week' }));
    fireEvent.change(screen.getAllByLabelText('Set name')[0] as HTMLElement, {
      target: { value: 'Soto special' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Set renamed')).toBeInTheDocument();
    expect(mockStore.listSets()[0]?.name).toBe('Soto special');
  });

  it('deletes a set with a second tap', async () => {
    saveSetThenChangeWeek('Soto week');
    renderSets();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(mockStore.listSets()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    expect(await screen.findByText('Set deleted')).toBeInTheDocument();
    expect(mockStore.listSets()).toHaveLength(0);
    expect(screen.getByText(/No saved sets yet/)).toBeInTheDocument();
  });

  it('speaks Indonesian', async () => {
    saveSetThenChangeWeek('Soto week');
    await i18n.changeLanguage('id');
    renderSets();
    expect(await screen.findByText('6 item · 5 gambar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pakai paket ini' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Simpan minggu ini sebagai paket' }),
    ).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});
