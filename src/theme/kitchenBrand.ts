import { useSyncExternalStore } from 'react';
import { kitchenPageTarget } from '../../shared/kitchenHeadLinks';
import { THEMES } from '../../shared/themes';
import { lastKitchenTheme, rememberKitchenTheme } from '../api/device/lastKitchen';
import type { Brand } from './designTokens';

// The kitchen's colour theme (D-064, per kitchen: `/preferences` `theme`; plan 024). On kitchen and
// order pages the Worker puts it in `<html data-brand>`, so the first render already has it. Pages
// with no kitchen in the URL (My orders, Settings) start from the last kitchen's theme; the server's
// value replaces it whenever a menu or order of a kitchen loads. The seller app sets it with
// `setKitchenBrand` once known. Light / dark is separate (themePreference).

const isBrand = (value: string | undefined): value is Brand => THEMES.some((t) => t === value);

/** The theme the page starts with: the server's, else (customer pages without a kitchen) the last kitchen's, else Onde Onde. */
export function initialKitchenBrand(): Brand {
  if (typeof document === 'undefined') return 'onde';
  const fromServer = document.documentElement.dataset.brand;
  if (isBrand(fromServer)) {
    rememberKitchenTheme(fromServer);
    return fromServer;
  }
  const { pathname } = window.location;
  const customerPageWithoutKitchen =
    kitchenPageTarget(pathname) === null && !/^\/(seller|admin)(\/|$)/.test(pathname);
  return (customerPageWithoutKitchen && lastKitchenTheme()) || 'onde';
}

const listeners = new Set<() => void>();
let current: Brand = initialKitchenBrand();

export function setKitchenBrand(next: Brand): void {
  // A kitchen's menu or order page: remember its theme for My orders and Settings. The seller and
  // admin apps set the theme too, but that is not a customer's kitchen.
  if (kitchenPageTarget(window.location.pathname) !== null) rememberKitchenTheme(next);
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useKitchenBrand(): Brand {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'onde',
  );
}
