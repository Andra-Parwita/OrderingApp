import { createElement, Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { MaintenanceHost } from './MaintenanceHost';
import { NoteHost } from './NoteHost';
import { registerMaintenanceI18n } from './i18n/register';

export { MaintenanceHost } from './MaintenanceHost';
export { NoteHost } from './NoteHost';
export { NotePreview } from './noteParts';
export { registerMaintenanceI18n } from './i18n/register';

/** Plan 046: mounts the maintenance notice bar and the "Updating" screen once, in their own root; plan 086 adds Bobo's short message. */
export function mountMaintenance(): void {
  registerMaintenanceI18n();
  const host = document.createElement('div');
  document.body.appendChild(host);
  createRoot(host).render(
    createElement(
      AppThemeProvider,
      null,
      createElement(Fragment, null, createElement(MaintenanceHost), createElement(NoteHost)),
    ),
  );
}
