import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AdminShell } from "./components/AdminShell";
import { useAuth } from "./auth/AuthContext";
import { AccountPage } from "./pages/AccountPage";
import { LoginPage } from "./pages/LoginPage";
import { PriceToolPage } from "./pages/PriceToolPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ShopAlertsPage } from "./pages/ShopAlertsPage";
import { ShopDashboardPage } from "./pages/ShopDashboardPage";
import { ShopListPage } from "./pages/ShopListPage";
import { ShopProductsPage } from "./pages/ShopProductsPage";
import { ShopSettingsPage } from "./pages/ShopSettingsPage";
import { AdminDomainsPage } from "./pages/AdminDomainsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { ShopScanLogsPage } from "./pages/ShopScanLogsPage";
import { ShopSetupPage } from "./pages/ShopSetupPage";
import { AdminSanityPage } from "./pages/AdminSanityPage";
import { ShopAnalyticsPage } from "./pages/ShopAnalyticsPage";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminScanEnginePage } from "./pages/AdminScanEnginePage";
import { AdminOperationsLogPage } from "./pages/AdminOperationsLogPage";
import { AdminSystemConfigPage } from "./pages/AdminSystemConfigPage";
import { ShopAiChatPage } from "./pages/ShopAiChatPage";
import { ShopWhatsappOnboardingPage } from "./pages/ShopWhatsappOnboardingPage";
import { AdminPackagesPage } from "./pages/AdminPackagesPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="content-area">טוען…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const { token, user, loading } = useAuth();
  if (loading) return <div className="content-area">טוען…</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (!user?.is_admin) return <Navigate to="/shops" replace />;
  return <>{children}</>;
}

/** מפנה /tool — רק מנהלים לפאנל; אחרים לחנויות */
function PriceToolGate() {
  const { token, user, loading } = useAuth();
  if (loading) return <div className="content-area">טוען…</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (user?.is_admin) return <Navigate to="/admin/tool" replace />;
  return <Navigate to="/shops" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/tool"
        element={
          <Protected>
            <PriceToolGate />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedAdmin>
            <AdminShell />
          </ProtectedAdmin>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="scan-engine" element={<AdminScanEnginePage />} />
        <Route path="operations" element={<AdminOperationsLogPage />} />
        <Route path="system" element={<AdminSystemConfigPage />} />
        <Route path="domains" element={<AdminDomainsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="tool" element={<PriceToolPage />} />
        <Route path="price-sanity" element={<AdminSanityPage />} />
      </Route>
      <Route
        path="/account"
        element={
          <Protected>
            <AccountPage />
          </Protected>
        }
      />
      <Route
        path="/shops"
        element={
          <Protected>
            <ShopListPage />
          </Protected>
        }
      />
      <Route path="/shops/:shopId" element={<RedirectToApp path="dashboard" />} />
      <Route path="/shops/:shopId/alerts" element={<RedirectToApp path="alerts" />} />
      <Route path="/shops/:shopId/logs" element={<RedirectToApp path="logs" />} />
      <Route path="/shops/:shopId/setup" element={<RedirectToApp path="setup" />} />
      <Route path="/dashboard" element={<Navigate to="/shops" replace />} />
      <Route
        path="/app/:shopId"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ShopDashboardPage />} />
        <Route path="products" element={<ShopProductsPage />} />
        <Route path="logs" element={<ShopScanLogsPage />} />
        <Route path="alerts" element={<ShopAlertsPage />} />
        <Route path="settings" element={<ShopSettingsPage />} />
        <Route path="setup" element={<ShopSetupPage />} />
        <Route path="analytics" element={<ShopAnalyticsPage />} />
        <Route path="assistant" element={<ShopAiChatPage />} />
        <Route path="assistant/whatsapp" element={<ShopWhatsappOnboardingPage />} />
      </Route>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Home() {
  const { token, user, loading } = useAuth();
  if (loading) return <div className="content-area">טוען…</div>;
  if (token && user?.is_admin) return <Navigate to="/admin" replace />;
  if (token) return <Navigate to="/shops" replace />;
  return <Navigate to="/login" replace />;
}

function RedirectToApp({ path }: { path: string }) {
  const { shopId } = useParams();
  return <Navigate to={`/app/${shopId}/${path}`} replace />;
}
