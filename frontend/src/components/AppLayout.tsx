import type { ReactNode } from "react";
import { BarChart3, Boxes, Coins, Eye, EyeOff, Home, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings } from "lucide-react";

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
  const visibleNavItems = brocanteFocusMode ? navItems.filter((item) => item.id === "brocante" || item.id === "settings") : navItems;

  return (
    <div className={privacyMode ? `app-frame privacy-mode${sidebarCollapsed ? " sidebar-collapsed" : ""}` : `app-frame${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="brand">
          <span>MF</span>
          <div className={sidebarCollapsed ? "brand-copy hidden" : "brand-copy"}>
            <strong>My Fin Apps</strong>
            <small>Pilotage perso</small>
          </div>
        </div>
        <button className="icon-button sidebar-collapse-toggle" type="button" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Ouvrir le menu" : "Ranger le menu"}>
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button className={privacyMode ? "nav-item active privacy-toggle" : "nav-item privacy-toggle"} type="button" onClick={onTogglePrivacyMode}>
          {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          <span className={sidebarCollapsed ? "nav-label hidden" : "nav-label"}>
            {privacyMode ? "Réafficher les chiffres" : "Masquer les chiffres"}
          </span>
        </button>
        <nav>
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => onPageChange(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {item.icon}
              <span className={sidebarCollapsed ? "nav-label hidden" : "nav-label"}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
