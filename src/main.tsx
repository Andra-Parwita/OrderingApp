import { StrictMode, createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, Route, Routes } from 'react-router';
import { App } from './app/App';
import { areaOf } from './app/area';
import { preloadStaffArea } from './app/AppRoutes';
import { CustomerTabBar, TAB_BAR_HEIGHT } from './app/CustomerShell';
import { AppThemeProvider } from './theme/AppThemeProvider';
import { createAppStore } from './app/store';
import { registerCustomerI18n } from './features/customer-menu';
import { registerCustomerOrdersI18n } from './features/customer-orders';
import { registerInstallI18n, startInstallSupport } from './components/install';
import { mountMaintenance } from './components/maintenance';
import { mountOfflineBanner } from './components/network';
import { mountUpdateBar } from './components/update';
import { startClientLog } from './api/clientLog';
import { startRememberMeSync } from './api/customer/sync';
import { registerRememberMeI18n } from './components/remember-me';
import { initI18n } from './i18n/init';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// ?harness=<name> mounts ./harness/<name>.tsx. Dev only: `import.meta.env.DEV` is false in a
// production build, so the glob and every harness are dropped from the bundle. The module
// exports a component named `Harness`; a file whose name differs from the query, or that
// exports another name, is listed in LEGACY. Harnesses bring their own store; i18n (with every
// feature's strings) is ready before they load.
const harnesses = import.meta.env.DEV
  ? import.meta.glob<Record<string, unknown>>('./harness/*.tsx')
  : {};
const LEGACY: Readonly<Record<string, { file: string; component: string }>> = {
  kit: { file: 'KitGallery', component: 'KitGallery' },
};

function findHarness(name: string | null) {
  if (name === null) return null;
  const legacy = LEGACY[name];
  const loader = harnesses[`./harness/${legacy?.file ?? name}.tsx`];
  return loader ? { loader, component: legacy?.component ?? 'Harness' } : null;
}

const harness = import.meta.env.DEV
  ? findHarness(new URLSearchParams(window.location.search).get('harness'))
  : null;

startClientLog();
// Plan 119: a staff address starts its chunk download now, in parallel with i18n.
if (areaOf(window.location.pathname) === 'staff') preloadStaffArea();

void initI18n().then(async () => {
  registerCustomerI18n();
  registerCustomerOrdersI18n();
  registerInstallI18n();
  registerRememberMeI18n();
  startRememberMeSync();
  startInstallSupport();
  mountUpdateBar();
  mountOfflineBanner();
  mountMaintenance();
  if (harness) {
    // Dev only: harnesses show staff screens, whose strings register with the staff chunk.
    await import('./app/StaffArea');
    const module = await harness.loader();
    const component = module[harness.component];
    if (typeof component === 'function') {
      createRoot(container).render(
        <StrictMode>{createElement(component as ComponentType)}</StrictMode>,
      );
      return;
    }
  }
  if (import.meta.env.DEV && window.location.pathname.startsWith('/__fixtures/')) {
    // Dev only (dropped from a production build): /__fixtures/:screenId renders a customer
    // design screen from fixtures, for the design-compare check. Here, not in the app's routes,
    // because only this file may import a harness.
    const { FixturesPage } = await import('./harness/customerFixtures/FixturesPage');
    createRoot(container).render(
      <StrictMode>
        <Provider store={createAppStore()}>
          <AppThemeProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/__fixtures/:screenId"
                  element={
                    <FixturesPage
                      tabBarHeight={TAB_BAR_HEIGHT}
                      tabBar={(active, unseen) => (
                        <CustomerTabBar active={active} unseen={unseen} menuHref="/" />
                      )}
                    />
                  }
                />
              </Routes>
            </BrowserRouter>
          </AppThemeProvider>
        </Provider>
      </StrictMode>,
    );
    return;
  }
  createRoot(container).render(
    <StrictMode>
      <App store={createAppStore()} />
    </StrictMode>,
  );
});
