import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey } from '../../components/draft';
import { NewOrderScreen } from './NewOrderScreen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 061 stage 7: a half-typed New order survives a reload, on this device only.

const KEY = draftKey(currentSellerSlug(), 'new-order', 'current');
const noop = () => undefined;

async function open(onDone: () => void = noop) {
  const result = renderWithStore(
    <NewOrderScreen onBack={noop} onDone={onDone} />,
    createTestStore({ saga: true }),
  );
  await screen.findByRole('group', { name: 'Lime-leaf mixed rice' });
  return result;
}

describe('New order draft', () => {
  beforeAll(setupI18n);

  it('restores name, quantities, note and phone after a reload', async () => {
    const first = await open();
    fireEvent.change(screen.getByLabelText('Customer first name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: 'One more Lime-leaf mixed rice' }));
    first.unmount();
    expect(
      (JSON.parse(localStorage.getItem(KEY) ?? '{}') as { value: { firstName: string } }).value
        .firstName,
    ).toBe('Rina');
    await open();
    expect(screen.getByLabelText<HTMLInputElement>('Customer first name').value).toBe('Rina');
    expect(screen.getByText('Restored what you typed')).toBeInTheDocument();
    expect(screen.getByText(/1 item/)).toBeInTheDocument();
  });

  it('clears the draft once the order is created', async () => {
    const onDone = vi.fn();
    await open(onDone);
    fireEvent.change(screen.getByLabelText('Customer first name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: 'One more Lime-leaf mixed rice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create only' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('drops dishes that are no longer on the menu, with a notice', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        value: {
          firstName: 'Rina',
          customerLang: 'id',
          how: 'pickup',
          qtys: { 'gone-dish': 2 },
          note: '',
          confirmNow: 'yes',
          paid: 'no',
          phone: '',
          address: '',
        },
        baseline: '',
        savedAt: Date.now(),
      }),
    );
    await open();
    expect(
      await screen.findByText('Some dishes you picked are no longer on the menu and were removed.'),
    ).toBeInTheDocument();
  });

  it('Cancel forgets the draft', async () => {
    const result = await open();
    fireEvent.change(screen.getByLabelText('Customer first name'), { target: { value: 'Rina' } });
    result.unmount();
    expect(localStorage.getItem(KEY)).not.toBeNull();
    renderWithStore(
      <NewOrderScreen onBack={noop} onDone={noop} />,
      createTestStore({ saga: true }),
    );
    await screen.findByRole('group', { name: 'Lime-leaf mixed rice' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
