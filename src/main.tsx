import { StrictMode, createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createAppStore } from './app/store';
import { registerCustomerI18n } from './features/customer-menu';
import { registerSellerI18n } from './features/seller-orders';
import { initI18n } from './i18n/init';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// ?harness=<name> mounts ./harness/<name>.tsx. Dev only: `import.meta.env.DEV` is false in a
// production build, so the glob and every harness are dropped from the bundle. The module
// exports a component named `Harness`; a file whose name differs from the query, or that
// exports another name, is listed in LEGACY. Harnesses bring their own store; i18n (with both
// features' strings) is ready before they load.
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

void initI18n().then(async () => {
  registerCustomerI18n();
  registerSellerI18n();
  if (harness) {
    const module = await harness.loader();
    const component = module[harness.component];
    if (typeof component === 'function') {
      createRoot(container).render(
        <StrictMode>{createElement(component as ComponentType)}</StrictMode>,
      );
      return;
    }
  }
  createRoot(container).render(
    <StrictMode>
      <App store={createAppStore()} />
    </StrictMode>,
  );
});
