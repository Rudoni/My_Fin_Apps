import { Suspense, lazy, useEffect, useState } from "react";
import { AuthUser, getMe, logout } from "./api/auth";
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
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const readPage = (): AppPage => {
    const value = window.location.hash.slice(1);
    return (["dashboard", "expenses", "resale", "brocante", "patrimony", "settings"] as string[]).includes(value) ? value as AppPage : "dashboard";
  };
  const [page, setPage] = useState<AppPage>(readPage);
  function navigate(next: AppPage) {
    if (page === next) return;
    window.location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const sync = () => { setPage(readPage()); window.scrollTo({ top: 0, behavior: "instant" }); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
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
      .then((user) => {
        setCurrentUser(user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setStoredAuthToken("");
        setIsAuthenticated(false);
        setCurrentUser(null);
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
        return <DashboardPage onNavigate={navigate} displayName={currentUser?.display_name} />;
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
            currentUser={currentUser}
            brocanteFocusMode={brocanteFocusMode}
            onToggleBrocanteFocusMode={setBrocanteFocusMode}
            onUserUpdated={setCurrentUser}
            onLogout={() => {
              void logout().catch(() => undefined).finally(() => {
                setStoredAuthToken("");
                setIsAuthenticated(false);
                setCurrentUser(null);
              });
            }}
          />
        );
      default:
        return <DashboardPage onNavigate={navigate} displayName={currentUser?.display_name} />;
    }
  }

  if (!authResolved) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <LoginPage onAuthenticated={(user) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <AppLayout
      page={page}
      onPageChange={navigate}
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
