// The customer's first name stays on this phone so the next checkout is prefilled (D-075).
export const FIRST_NAME_KEY = 'firstName';

export function rememberFirstName(name: string): void {
  const trimmed = name.trim();
  if (trimmed === '') return;
  try {
    localStorage.setItem(FIRST_NAME_KEY, trimmed);
  } catch {
    // storage unavailable: checkout just asks again
  }
}

export function savedFirstName(): string {
  try {
    return localStorage.getItem(FIRST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
