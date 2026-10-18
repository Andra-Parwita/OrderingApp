import { Route } from 'react-router';
import { AdminGuard } from './guards';
import { AdminHomeRoute, AdminSetupRoute, AdminSignInRoute } from './AuthRoutes';

export function adminRoutes() {
  return (
    <>
      <Route path="/admin/setup" element={<AdminSetupRoute />} />
      <Route path="/admin/sign-in" element={<AdminSignInRoute />} />
      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminHomeRoute />
          </AdminGuard>
        }
      />
    </>
  );
}
