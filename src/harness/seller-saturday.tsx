import { AppThemeProvider } from '../theme/AppThemeProvider';
import {
  DeliveryRunScreen,
  HandOverScreen,
  SendUpdateScreen,
  registerSellerSaturdayI18n,
} from '../features/seller-saturday';

// ?harness=seller-saturday&screen=handover|delivery|update; talks to the dev Worker mock API.
// Own theme and strings, so the screens run without the app shell (7.3 adds the routes).

registerSellerSaturdayI18n();

function Screen() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (screen === 'delivery') return <DeliveryRunScreen />;
  if (screen === 'update') return <SendUpdateScreen />;
  return <HandOverScreen />;
}

export function SellerSaturdayHarness() {
  return (
    <AppThemeProvider>
      <Screen />
    </AppThemeProvider>
  );
}

export const Harness = SellerSaturdayHarness;
