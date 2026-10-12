import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { Languages } from '../../../shared/domain';
import { selectMenu } from './selectors';

/** Plan 056: the languages the loaded kitchen offers to customers ("both" until a menu is loaded). */
export function useKitchenLanguages(): Languages {
  const menu = useSelector(selectMenu);
  return menu.status === 'ready' ? (menu.data.languages ?? 'both') : 'both';
}

const STORAGE_KEY = 'lang';

function savedChoice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function restoreChoice(saved: string | null): void {
  try {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, saved);
  } catch {
    // storage unavailable: nothing to restore
  }
}

/**
 * A one-language kitchen shows the customer app in that language (the EN / ID switch is hidden
 * where this is "en" or "id"). Mounted once, in the customer shell. The forced language is for
 * the customer pages only: the person's saved choice (shared with the seller app on this device)
 * is put back after the change, and the shown language returns to it when the pages close.
 */
export function useForcedKitchenLanguage(): void {
  const languages = useKitchenLanguages();
  const { i18n } = useTranslation();
  // The language and saved choice from before anything was forced; set once.
  const original = useRef<{ language: string; saved: string | null } | null>(null);
  useEffect(() => {
    if (languages === 'both' || i18n.language.startsWith(languages)) return;
    original.current ??= { language: i18n.language, saved: savedChoice() };
    const { saved } = original.current;
    void i18n.changeLanguage(languages).then(() => restoreChoice(saved));
  }, [languages, i18n]);
  useEffect(
    () => () => {
      const before = original.current;
      if (before) void i18n.changeLanguage(before.language).then(() => restoreChoice(before.saved));
    },
    // Only on leaving the customer pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
