import { Provider } from 'react-redux';
import { HelloScreen } from '../features/hello/HelloScreen';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import type { AppStore } from './store';

export function App({ store }: { store: AppStore }) {
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <HelloScreen />
      </AppThemeProvider>
    </Provider>
  );
}
