import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerTranslateI18n } from './i18n/register';
import { TranslateButton } from './TranslateButton';

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerTranslateI18n();
});
beforeEach(async () => {
  await i18n.changeLanguage('en');
});
afterEach(() => vi.restoreAllMocks());

function reply(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }));
}

function setup(from: 'en' | 'id' = 'id') {
  const onResult = vi.fn();
  render(
    <AppThemeProvider>
      <TranslateButton
        text="Pisang goreng"
        from={from}
        to={from === 'id' ? 'en' : 'id'}
        onResult={onResult}
      />
    </AppThemeProvider>,
  );
  return onResult;
}

describe('TranslateButton', () => {
  it('names the source language, in English and Indonesian', async () => {
    setup('id');
    expect(screen.getByRole('button', { name: '⇄ From Indonesian' })).toBeVisible();
    await i18n.changeLanguage('id');
    expect(await screen.findByRole('button', { name: '⇄ Dari bahasa Indonesia' })).toBeVisible();
  });

  it('shows From English for an English source', () => {
    setup('en');
    expect(screen.getByRole('button', { name: '⇄ From English' })).toBeVisible();
  });

  it('is busy while waiting, then hands over the translation', async () => {
    let finish: (r: Response) => void = () => undefined;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const onResult = setup();
    fireEvent.click(screen.getByRole('button'));
    const busy = await screen.findByRole('button', { name: 'Translating…' });
    expect(busy).toBeDisabled();
    finish(Response.json({ text: 'Fried banana' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('Fried banana'));
    expect(screen.getByRole('button', { name: '⇄ From Indonesian' })).toBeEnabled();
  });

  it('says the day is used up on 429, without calling again', async () => {
    const fetchSpy = reply(429, { error: 'translate_limit', message: 'x' });
    const onResult = setup();
    fireEvent.click(screen.getByRole('button'));
    expect(
      await screen.findByText('Translation is resting for today. Type it yourself.'),
    ).toBeVisible();
    expect(onResult).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('says it is not available on 503, in Indonesian too', async () => {
    reply(503, { error: 'translate_unavailable', message: 'x' });
    setup();
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText("Translation isn't available right now.")).toBeVisible();
    await i18n.changeLanguage('id');
    expect(await screen.findByText('Terjemahan belum tersedia saat ini.')).toBeVisible();
  });
});
