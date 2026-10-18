// Plan 106: "Don't ask for this order" on the link window. Remembered per order code on this device.

const KEY = 'sellerLinkMuted.v1';

function read(): Array<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export const isPromptMuted = (code: string): boolean => read().includes(code);

/** Remembers the order code (newest 200 kept). Storage that is blocked just means it asks again. */
export function mutePrompt(code: string): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([...read().filter((c) => c !== code), code].slice(-200)),
    );
  } catch {
    // ask again next time
  }
}
