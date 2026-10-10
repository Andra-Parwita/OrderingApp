import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import type { AppStore } from './store';

// Library mode with <BrowserRouter>: the app has no loaders or actions, so the data-router
// features would be unused weight. State stays in Redux; the router owns the URL only.
export function App({ store }: Readonly<{ store: AppStore }>) {
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppThemeProvider>
    </Provider>
  );
}
