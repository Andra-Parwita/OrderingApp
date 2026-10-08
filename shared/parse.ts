import type { Language, LocalText } from './domain';

export type Json = Record<string, unknown>;

export function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isOneOf<T extends string>(values: ReadonlyArray<T>, value: unknown): value is T {
  return typeof value === 'string' && (values as ReadonlyArray<string>).includes(value);
}

export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Parses every element; null if the input is not an array or any element is rejected. */
export function parseArray<T>(
  input: unknown,
  parseItem: (item: unknown) => T | null,
): Array<T> | null {
  if (!Array.isArray(input)) return null;
  const out: Array<T> = [];
  for (const item of input as Array<unknown>) {
    const parsed = parseItem(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'id';
}

export function parseLocalText(input: unknown): LocalText | null {
  if (!isRecord(input)) return null;
  const { en, id } = input;
  if (typeof en !== 'string' || typeof id !== 'string') return null;
  return { en, id };
}
