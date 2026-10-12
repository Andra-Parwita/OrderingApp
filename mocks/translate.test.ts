// @vitest-environment node
// Plan 057, stage 1: POST /api/seller/translate with a fake Workers AI binding. Owner and chef may,
// a helper gets 403, a text over 500 characters 400, the 101st of a day 429, no binding 503.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import type { AiLike, TranslateContext } from '../worker/api/translate';
import { devApi, useWorld, type World } from './impl';

const SELLER_ID = 'seller-onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('translate route (plan 057)', () => {
  const create = useWorld('translate');
  let world: World;
  let tokens = 0;

  type Reply = { status: number; body: unknown; setCookie: string | null };
  async function call(
    path: string,
    options: { token?: string; body?: unknown },
    translate?: TranslateContext,
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method: 'POST',
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      translate ? { translate } : {},
    );
    if (!response) return { status: -1, body: null, setCookie: null };
    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');
    try {
      return { status: response.status, body: JSON.parse(text) as unknown, setCookie };
    } catch {
      return { status: response.status, body: text, setCookie };
    }
  }

  function session(reply: Reply) {
    const parsed = parseSessionResponse(reply.body);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!parsed || !token) throw new Error(`not a session: ${JSON.stringify(reply)}`);
    return { ...parsed, token };
  }
  const keyOf = (reply: Reply) => {
    const parsed = parseKeyResponse(reply.body);
    if (!parsed) throw new Error(`not a key: ${JSON.stringify(reply)}`);
    return parsed;
  };
  async function newPerson(inviteKey: string, deviceId: string, password: string) {
    const setup = session(await call('/api/auth/invite', { body: { key: inviteKey, deviceId } }));
    return session(
      await call('/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password, deviceName: 'Phone' },
      }),
    );
  }

  beforeEach(async () => {
    tokens = 0;
    world = await create({
      now: () => new Date(START),
      newToken: () => `token-${String(++tokens)}`,
    });
  });

  async function people() {
    const ownerKey = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'Olive',
    });
    const owner = await newPerson(ownerKey.key, 'owner-0001-aaaa', 'correct horse battery');
    const helperInvite = await call('/api/seller/invites', {
      token: owner.token,
      body: { displayName: 'Dewi', role: 'helper' },
    });
    const helper = await newPerson(
      keyOf(helperInvite).key,
      'helper-0001-bb',
      'helper long password',
    );
    const chefInvite = await call('/api/seller/chef-invites', {
      token: owner.token,
      body: { chefId: 'wati' },
    });
    const chef = await newPerson(keyOf(chefInvite).key, 'wati-0001-bbbb', 'chef long password');
    return { owner, helper, chef };
  }

  /** A fake binding and an in-memory day counter (the real one is the kitchen's Durable Object). */
  function fake() {
    const run = vi.fn<AiLike['run']>(() => Promise.resolve({ translated_text: ' Fried banana ' }));
    const counts = new Map<string, number>();
    const translate: TranslateContext = {
      ai: { run },
      takeSlot: (sellerId, day, cap) => {
        const key = `${sellerId}:${day}`;
        const used = counts.get(key) ?? 0;
        if (used >= cap) return Promise.resolve(false);
        counts.set(key, used + 1);
        return Promise.resolve(true);
      },
    };
    return { run, translate };
  }

  const ask = { text: 'Pisang goreng', from: 'id', to: 'en' };
  const errorOf = (reply: Reply) => (reply.body as { error?: string }).error;

  it('translates for the owner and a chef, sending only the text and languages', async () => {
    const { owner, chef } = await people();
    const { run, translate } = fake();
    for (const who of [owner, chef]) {
      const reply = await call('/api/seller/translate', { token: who.token, body: ask }, translate);
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ text: 'Fried banana' });
    }
    expect(run).toHaveBeenCalledWith('@cf/meta/m2m100-1.2b', {
      text: 'Pisang goreng',
      source_lang: 'id',
      target_lang: 'en',
    });
  });

  it('refuses a helper with 403 and never calls the AI', async () => {
    const { helper } = await people();
    const { run, translate } = fake();
    const reply = await call(
      '/api/seller/translate',
      { token: helper.token, body: ask },
      translate,
    );
    expect(reply.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses bad input with 400: too long, same language, empty, unknown language', async () => {
    const { owner } = await people();
    const { run, translate } = fake();
    for (const body of [
      { ...ask, text: 'x'.repeat(501) },
      { ...ask, to: 'id' },
      { ...ask, text: '   ' },
      { ...ask, to: 'fr' },
    ]) {
      const reply = await call('/api/seller/translate', { token: owner.token, body }, translate);
      expect(reply.status).toBe(400);
    }
    const edge = await call(
      '/api/seller/translate',
      { token: owner.token, body: { ...ask, text: 'x'.repeat(500) } },
      translate,
    );
    expect(edge.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('allows 100 a day, answers the 101st with 429 translate_limit', async () => {
    const { owner } = await people();
    const { run, translate } = fake();
    for (let i = 0; i < 100; i += 1) {
      const ok = await call('/api/seller/translate', { token: owner.token, body: ask }, translate);
      expect(ok.status).toBe(200);
    }
    const over = await call('/api/seller/translate', { token: owner.token, body: ask }, translate);
    expect(over.status).toBe(429);
    expect(errorOf(over)).toBe('translate_limit');
    expect(run).toHaveBeenCalledTimes(100);
  });

  it('answers 503 translate_unavailable with no binding, or when the AI fails or answers oddly', async () => {
    const { owner } = await people();
    const none = await call('/api/seller/translate', { token: owner.token, body: ask });
    expect(none.status).toBe(503);
    expect(errorOf(none)).toBe('translate_unavailable');

    const { run, translate } = fake();
    run.mockRejectedValueOnce(new Error('AI down'));
    const failed = await call(
      '/api/seller/translate',
      { token: owner.token, body: ask },
      translate,
    );
    expect(failed.status).toBe(503);
    run.mockResolvedValueOnce({});
    const odd = await call('/api/seller/translate', { token: owner.token, body: ask }, translate);
    expect(odd.status).toBe(503);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
