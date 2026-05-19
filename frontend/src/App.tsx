import { Suspense, lazy, useEffect, useState } from "react";
import { getMe, logout } from "./api/auth";
import { getStoredAuthToken, setStoredAuthToken } from "./api/client";
import { AppLayout, AppPage } from "./components/AppLayout";
import { PageLoader } from "./components/PageLoader";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const BrocantePage = lazy(() => import("./pages/BrocantePage").then((module) => ({ default: module.BrocantePage })));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage").then((module) => ({ default: module.ExpensesPage })));
const PatrimonyPage = lazy(() => import("./pages/PatrimonyPage").then((module) => ({ default: module.PatrimonyPage })));
const ResalePage = lazy(() => import("./pages/ResalePage").then((module) => ({ default: module.ResalePage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

export function App() {
  const [authResolved, setAuthResolved] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [page, setPage] = useState<AppPage>("dashboard");
  const [brocanteFocusMode, setBrocanteFocusMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrocanteFocusMode(window.localStorage.getItem("mf-brocante-focus-mode") === "true");
    setPrivacyMode(window.localStorage.getItem("mf-privacy-mode") === "true");
    setSidebarCollapsed(window.localStorage.getItem("mf-sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      setAuthResolved(true);
      setIsAuthenticated(false);
      return;
    }

    void getMe()
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        setStoredAuthToken("");
        setIsAuthenticated(false);
      })
      .finally(() => setAuthResolved(true));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mf-brocante-focus-mode", String(brocanteFocusMode));
  }, [brocanteFocusMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mf-privacy-mode", String(privacyMode));
  }, [privacyMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mf-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  function renderCurrentPage() {
    switch (page) {
      case "dashboard":
        return <DashboardPage />;
      case "expenses":
        return <ExpensesPage />;
      case "resale":
        return <ResalePage />;
      case "brocante":
        return <BrocantePage />;
      case "patrimony":
        return <PatrimonyPage />;
      case "settings":
        return (
          <SettingsPage
            brocanteFocusMode={brocanteFocusMode}
            onToggleBrocanteFocusMode={setBrocanteFocusMode}
            onLogout={() => {
              void logout().catch(() => undefined).finally(() => {
                setStoredAuthToken("");
                setIsAuthenticated(false);
              });
            }}
          />
        );
      default:
        return <DashboardPage />;
    }
  }

  if (!authResolved) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <AppLayout
      page={page}
      onPageChange={setPage}
      brocanteFocusMode={brocanteFocusMode}
      privacyMode={privacyMode}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
      onTogglePrivacyMode={() => setPrivacyMode((value) => !value)}
    >
      <Suspense fallback={<PageLoader />}>{renderCurrentPage()}</Suspense>
    </AppLayout>
  );
}
