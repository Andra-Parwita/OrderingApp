import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasInstallPrompt, promptInstall, setSavedInstallPrompt } from './installPrompt';

// Plan 102: an install prompt saved on one kitchen's page must not install another kitchen's app.

function setManifest(href: string | null) {
  document.head.querySelectorAll('link[rel="manifest"]').forEach((link) => link.remove());
  if (href === null) return;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = href;
  document.head.append(link);
}

function fakeEvent() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  return {
    prompt,
    event: { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) } as never,
  };
}

afterEach(() => {
  setSavedInstallPrompt(null);
  setManifest(null);
});

describe('installPrompt', () => {
  it('shows the saved prompt while the page keeps the manifest it was saved for', async () => {
    setManifest('/api/manifest/onde-onde');
    const { prompt, event } = fakeEvent();
    setSavedInstallPrompt(event);
    expect(hasInstallPrompt()).toBe(true);
    expect(await promptInstall()).toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(hasInstallPrompt()).toBe(false);
  });

  it('drops the event when the manifest link changed to another kitchen', async () => {
    setManifest('/api/manifest/onde-onde');
    const { prompt, event } = fakeEvent();
    setSavedInstallPrompt(event);
    setManifest('/api/manifest/dellavee');
    expect(await promptInstall()).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
    // Gone for good: coming back to the first kitchen does not revive it.
    setManifest('/api/manifest/onde-onde');
    expect(hasInstallPrompt()).toBe(false);
  });

  it('hasInstallPrompt drops a mismatched event too', () => {
    setManifest('/api/manifest/onde-onde');
    setSavedInstallPrompt(fakeEvent().event);
    setManifest(null);
    expect(hasInstallPrompt()).toBe(false);
  });
});
