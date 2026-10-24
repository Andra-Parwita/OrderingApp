import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { areaOf } from './area';
import { customerRoutes } from './customerRoutes';
import { HomePage, NotFoundPage } from './pages';

const loadStaffArea = () => import('./StaffArea').then((m) => ({ default: m.StaffArea }));
const StaffArea = lazy(loadStaffArea);

/** Starts the staff chunk download early (main.tsx, for a staff address). */
export function preloadStaffArea(): void {
  void loadStaffArea();
}

export function AppRoutes() {
  const location = useLocation();
  if (areaOf(location.pathname) === 'staff') {
    // null: #root stays empty, so the plan-115 splash covers the gap while the chunk loads.
    return (
      <Suspense fallback={null}>
        <StaffArea />
      </Suspense>
    );
  }
  return (
    <Routes>
      {/* "/" is a plain page: no tab bar, no customer shell. */}
      <Route path="/" element={<HomePage />} />
      {customerRoutes()}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
