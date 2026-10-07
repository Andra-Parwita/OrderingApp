import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initI18n } from './i18n/init';
import { createAppStore } from './app/store';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

void initI18n().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App store={createAppStore()} />
    </StrictMode>,
  );
});
