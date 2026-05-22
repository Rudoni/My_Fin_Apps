import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Boxes, Coins, Eye, EyeOff, Home, Menu, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings, X } from "lucide-react";
import { useIsMobile } from "../hooks/useIsMobile";

export type AppPage = "dashboard" | "expenses" | "resale" | "brocante" | "patrimony" | "settings";

type AppLayoutProps = {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  brocanteFocusMode: boolean;
  privacyMode: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onTogglePrivacyMode: () => void;
  children: ReactNode;
};

const navItems: Array<{ id: AppPage; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <Home size={18} /> },
  { id: "expenses", label: "Dépenses", icon: <ReceiptText size={18} /> },
  { id: "resale", label: "Achat-revente", icon: <BarChart3 size={18} /> },
  { id: "brocante", label: "Stock brocante", icon: <Boxes size={18} /> },
  { id: "patrimony", label: "Patrimoine", icon: <Coins size={18} /> },
  { id: "settings", label: "Réglages", icon: <Settings size={18} /> },
];

export function AppLayout({
  page,
  onPageChange,
  brocanteFocusMode,
  privacyMode,
  sidebarCollapsed,
  onToggleSidebar,
  onTogglePrivacyMode,
  children,
}: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const visibleNavItems = brocanteFocusMode ? navItems.filter((item) => item.id === "brocante" || item.id === "settings") : navItems;
  const mobilePrimaryNavItems = visibleNavItems.filter((item) => item.id !== "settings").slice(0, 5);
  const appFrameClassName = privacyMode
    ? `app-frame privacy-mode${sidebarCollapsed && !isMobile ? " sidebar-collapsed" : ""}`
    : `app-frame${sidebarCollapsed && !isMobile ? " sidebar-collapsed" : ""}`;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [page]);

  return (
    <div className={appFrameClassName}>
      <div className="mobile-topbar">
        <button className="icon-button mobile-topbar-button" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Ouvrir le menu">
          <Menu size={18} />
        </button>
        <div className="mobile-topbar-brand">
          <span>MF</span>
          <div>
            <strong>My Fin Apps</strong>
            <small>Pilotage perso</small>
          </div>
        </div>
        <button className="icon-button mobile-topbar-button" type="button" onClick={onTogglePrivacyMode} aria-label={privacyMode ? "Réafficher les chiffres" : "Masquer les chiffres"}>
          {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {mobileNavOpen ? <button className="mobile-nav-backdrop" type="button" aria-label="Fermer le menu" onClick={() => setMobileNavOpen(false)} /> : null}
      <aside className={`${sidebarCollapsed && !isMobile ? "sidebar collapsed" : "sidebar"}${mobileNavOpen ? " mobile-open" : ""}`}>
        <div className="brand">
          <span>MF</span>
          <div className={sidebarCollapsed && !isMobile ? "brand-copy hidden" : "brand-copy"}>
            <strong>My Fin Apps</strong>
            <small>Pilotage perso</small>
          </div>
          <button className="icon-button mobile-close-button" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>
        {!isMobile ? (
          <button className="icon-button sidebar-collapse-toggle" type="button" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Ouvrir le menu" : "Ranger le menu"}>
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        ) : null}
        <button className={privacyMode ? "nav-item active privacy-toggle" : "nav-item privacy-toggle"} type="button" onClick={onTogglePrivacyMode}>
          {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          <span className={sidebarCollapsed && !isMobile ? "nav-label hidden" : "nav-label"}>
            {privacyMode ? "Réafficher les chiffres" : "Masquer les chiffres"}
          </span>
        </button>
        <nav>
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                onPageChange(item.id);
                setMobileNavOpen(false);
              }}
              title={sidebarCollapsed && !isMobile ? item.label : undefined}
            >
              {item.icon}
              <span className={sidebarCollapsed && !isMobile ? "nav-label hidden" : "nav-label"}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="app-content">
        {children}
        {isMobile ? (
          <nav className="mobile-bottom-nav" aria-label="Navigation principale">
            {mobilePrimaryNavItems.map((item) => (
              <button key={item.id} className={page === item.id ? "mobile-bottom-item active" : "mobile-bottom-item"} type="button" onClick={() => onPageChange(item.id)}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
