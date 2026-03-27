import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingOverlay } from "@mantine/core";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { InstanceProvider } from "./context/InstanceContext";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { BackupsPage } from "./pages/BackupsPage";
import { RestorePage } from "./pages/RestorePage";
import { ConfigPage } from "./pages/ConfigPage";
import { LogsPage } from "./pages/LogsPage";
import { InstancesPage } from "./pages/InstancesPage";

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingOverlay visible />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <InstanceProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/backups" element={<BackupsPage />} />
          <Route path="/restores" element={<RestorePage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/instances" element={<InstancesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </InstanceProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
