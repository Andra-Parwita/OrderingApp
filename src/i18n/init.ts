import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import id from './id.json';

const STORAGE_KEY = 'lang';
export type Language = 'en' | 'id';

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'id';
}

export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // storage unavailable: fall through to the browser language
  }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return browser.startsWith('id') ? 'id' : 'en';
}

function remember(language: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

export async function initI18n(): Promise<typeof i18n> {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, id: { translation: id } },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
  document.documentElement.lang = i18n.language;
  i18n.on('languageChanged', (language) => {
    remember(language);
    document.documentElement.lang = language;
  });
  return i18n;
}
