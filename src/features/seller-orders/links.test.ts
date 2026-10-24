import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../../../shared/domain';
import { setSessionSeller } from '../../api/device/sellerContext';
import { editCopyMessage } from './editMessage';

// Plan 102 stage 6: the seller's messages carry /<slug>/o/<token> of the signed-in kitchen.
const order = {
  token: 'tok123',
  code: 'K7F2QX',
  firstName: 'Rina',
  language: 'en',
  lines: [],
  audit: [{ what: 'edited', diff: { items: [] } }],
} as unknown as Order;

describe('seller order links', () => {
  beforeEach(() => {
    vi.spyOn(i18n, 'getFixedT').mockImplementation(
      (() => (_key: string, vars: { link: string }) => vars.link) as never,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('the edit message link is under the signed-in kitchen', () => {
    setSessionSeller('dapur-demo');
    expect(editCopyMessage(order)).toBe(`${window.location.origin}/dapur-demo/o/tok123`);
  });
});
