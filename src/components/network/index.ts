import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { OfflineBanner } from './OfflineBanner';
import { registerNetworkI18n } from './i18n/register';

export { OfflineBanner } from './OfflineBanner';
export { useNetworkState } from './useNetworkState';
export { registerNetworkI18n } from './i18n/register';

/** Plan 062: mounts the offline banner once, in its own root, so every seller and customer screen has it. */
export function mountOfflineBanner(): void {
  registerNetworkI18n();
  const host = document.createElement('div');
  document.body.appendChild(host);
  createRoot(host).render(createElement(AppThemeProvider, null, createElement(OfflineBanner)));
}
