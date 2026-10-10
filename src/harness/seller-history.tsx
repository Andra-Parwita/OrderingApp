import { AppThemeProvider } from '../theme/AppThemeProvider';
import { LabelsScreen, registerSellerLabelsI18n } from '../features/seller-labels';
import {
  BackupScreen,
  PastWeeksScreen,
  registerSellerHistoryI18n,
} from '../features/seller-history';

// ?harness=seller-history&screen=labels|past|backup; talks to the dev Worker mock API.
// Own theme and strings, so the screens run without the app shell (6.3 adds the routes).

registerSellerLabelsI18n();
registerSellerHistoryI18n();

function Screen() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (screen === 'past') return <PastWeeksScreen />;
  if (screen === 'backup') return <BackupScreen />;
  return <LabelsScreen />;
}

export function SellerHistoryHarness() {
  return (
    <AppThemeProvider>
      <Screen />
    </AppThemeProvider>
  );
}

export const Harness = SellerHistoryHarness;
