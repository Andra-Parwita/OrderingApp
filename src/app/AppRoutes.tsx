import { Route, Routes, useLocation } from 'react-router';
import { isWizardPath, wizardBackground } from '../features/seller-menu';
import { adminRoutes } from './adminRoutes';
import { customerRoutes } from './customerRoutes';
import { HomePage, NotFoundPage } from './pages';
import { SessionProvider } from './session';
import { MENU_BACKGROUND, RealLocation, sellerEntryRoutes, sellerRoutes } from './sellerRoutes';

export function AppRoutes() {
  const location = useLocation();
  // A wizard address shows its background screen in the shell and the wizard in a layer.
  const background = isWizardPath(location.pathname)
    ? (wizardBackground(location.state) ?? MENU_BACKGROUND)
    : undefined;
  return (
    <SessionProvider>
      <RealLocation.Provider value={location}>
        {/* Only a wizard overrides the location: react-router reports every overridden location as a Pop, which would stop the customer pages sliding in. */}
        <Routes location={background}>
          {/* "/" is a plain page: no tab bar, no customer shell. */}
          <Route path="/" element={<HomePage />} />
          {customerRoutes()}
          {sellerEntryRoutes()}
          {adminRoutes()}
          {sellerRoutes()}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </RealLocation.Provider>
    </SessionProvider>
  );
}
