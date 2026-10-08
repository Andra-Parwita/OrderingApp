import type { Language, LocalText } from './domain';

/** The text in the chosen language; if it is empty, the other language is shown. */
export function pickText(text: LocalText, lang: Language): string {
  const other: Language = lang === 'en' ? 'id' : 'en';
  return text[lang].trim() !== '' ? text[lang] : text[other];
}
