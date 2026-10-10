import { useState } from 'react';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import {
  AdminHomeScreen,
  AdminSetupScreen,
  AdminSignInScreen,
  registerAdminI18n,
} from '../features/admin';

// ?harness=admin&screen=setup|signin|home; talks to the dev Worker mock API.
// Own theme and strings, so the screens run without the app shell (7.3 adds the routes).

registerAdminI18n();

type Screen = 'setup' | 'signin' | 'home';

function initial(): Screen {
  const screen = new URLSearchParams(window.location.search).get('screen');
  return screen === 'setup' || screen === 'home' ? screen : 'signin';
}

export function AdminHarness() {
  const [screen, setScreen] = useState<Screen>(initial);
  return (
    <AppThemeProvider>
      {screen === 'setup' ? <AdminSetupScreen onDone={() => setScreen('home')} /> : null}
      {screen === 'signin' ? <AdminSignInScreen onSignedIn={() => setScreen('home')} /> : null}
      {screen === 'home' ? (
        <AdminHomeScreen
          onSignedOut={() => setScreen('signin')}
          onSignInNeeded={() => setScreen('signin')}
        />
      ) : null}
    </AppThemeProvider>
  );
}

export const Harness = AdminHarness;
