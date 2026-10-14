import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import AuthShell from "../features/auth/AuthShell";
import ArrivalSplash from "../features/auth/ArrivalSplash";
import { AUTH_PATHS, normalizePath } from "../features/auth/authPaths";
import DashboardPage from "../features/dashboard/DashboardPage";
import InboxPage from "../features/inbox/InboxPage.tsx";
import {SettingsPage} from "../features/settings/SettingsPage";

/**
 * Sign-in, sign-up, verify and the optional authenticator step all render
 * inside AuthShell, which slides between them. Everything else uses normal
 * routes.
 */
function AppRoutes() {
  const { pathname } = useLocation();

  if (AUTH_PATHS.includes(normalizePath(pathname))) return <AuthShell />;

  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/messageboard" element={<InboxPage />} />
      <Route path="/settings/:section?" element={<SettingsPage />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      {/* Above every route, so it can cover the switch from sign-up to the dashboard. */}
      <ArrivalSplash />
    </BrowserRouter>
  );
}

export default App;
