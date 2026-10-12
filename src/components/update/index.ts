import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { UpdateBar } from './UpdateBar';
import { registerUpdateI18n } from './i18n/register';
import { reloadOnPreloadError } from './updateCheck';

export { UpdateBar } from './UpdateBar';
export { registerUpdateI18n } from './i18n/register';

/** Plan 059: mounts the "new version" bar in its own root and reloads once on a stale-chunk error. */
export function mountUpdateBar(): void {
  reloadOnPreloadError();
  if (import.meta.env.DEV) return;
  registerUpdateI18n();
  const host = document.createElement('div');
  document.body.appendChild(host);
  createRoot(host).render(createElement(AppThemeProvider, null, createElement(UpdateBar)));
}
