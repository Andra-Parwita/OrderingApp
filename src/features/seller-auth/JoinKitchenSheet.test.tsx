import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../../shared/authContract';
import { JoinKitchenSheet } from './JoinKitchenSheet';
import { renderScreen, setupI18n } from './testSupport';

const joined: Me = {
  role: 'seller',
  stage: 'full',
  sellerId: 's2',
  slug: 'onde-onde',
  sellerName: 'Onde Onde',
};
const signInWithKey = vi.fn();
vi.mock('../../api/auth', () => ({
  signInWithKey: (key: string): unknown => signInWithKey(key),
}));

beforeAll(setupI18n);
beforeEach(() => signInWithKey.mockReset());

const open = () => {
  const onJoined = vi.fn();
  const onClose = vi.fn();
  renderScreen(<JoinKitchenSheet onClose={onClose} onJoined={onJoined} />);
  return { onJoined, onClose };
};
const typeKey = (value: string) =>
  fireEvent.change(screen.getByLabelText('Invite key from the kitchen owner'), {
    target: { value },
  });

describe('JoinKitchenSheet', () => {
  it('joins with the key and hands over the new session', async () => {
    signInWithKey.mockResolvedValue({ ok: true, data: { me: joined } });
    const { onJoined } = open();
    typeKey('abcd-efgh');
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(joined));
    expect(signInWithKey).toHaveBeenCalledOnce();
  });

  it('shows the error for a wrong key and stays open', async () => {
    signInWithKey.mockResolvedValue({ ok: false, error: 'invalid_credentials' });
    const { onJoined } = open();
    typeKey('wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText(/That did not work/)).toBeInTheDocument();
    expect(onJoined).not.toHaveBeenCalled();
  });

  it('asks for a key when the field is empty, and Cancel closes', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText('Type the key you were sent.')).toBeInTheDocument();
    expect(signInWithKey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
