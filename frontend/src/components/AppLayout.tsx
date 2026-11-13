import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Boxes, Coins, Eye, EyeOff, Home, Menu, PanelLeftClose, PanelLeftOpen, ReceiptText, Search, Settings, X, ArrowUpRight } from "lucide-react";
import { Modal } from "./Modal";
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
  { id: "dashboard", label: "Vue d’ensemble", icon: <Home size={18} /> },
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen((open) => !open); setQuery("");
      }
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
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
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Aller au contenu</a>
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
        <nav aria-label="Navigation principale">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              aria-current={page === item.id ? "page" : undefined}
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
        <div className="workspace-footer">
          <button type="button" className="workspace-search" aria-label="Rechercher une page" onClick={() => { setQuery(""); setCommandOpen(true); setMobileNavOpen(false); }}>
            <Search size={18} /><span className={sidebarCollapsed && !isMobile ? "hidden" : ""}>Accès rapide <kbd>⌘ K</kbd></span>
          </button>
          {(!sidebarCollapsed || isMobile) && <p>Un peu de clarté.<br /><strong>Beaucoup de possibilités.</strong></p>}
        </div>
      </aside>
      <div className="app-content" id="main-content" tabIndex={-1} key={page}>
        <div className="workspace-topline"><span>MON ESPACE <span>/</span> {navItems.find((item) => item.id === page)?.label}</span><button type="button" onClick={() => { setQuery(""); setCommandOpen(true); }}><Search size={15} /> Aller à une page <kbd>⌘ K</kbd></button></div>
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
      {commandOpen && <Modal title="Où veux-tu aller ?" eyebrow="Accès rapide" onClose={() => setCommandOpen(false)}>
        <div className="command-search"><Search size={20} /><input autoFocus aria-label="Rechercher une page" placeholder="Dépenses, patrimoine, brocante…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="command-results">
          {visibleNavItems.filter((item) => normalize(item.label).includes(normalize(query))).map((item) => <button type="button" key={item.id} onClick={() => { onPageChange(item.id); setCommandOpen(false); setMobileNavOpen(false); }}>{item.icon}<span>{item.label}</span><ArrowUpRight size={18} /></button>)}
          {!visibleNavItems.some((item) => normalize(item.label).includes(normalize(query))) && <p className="section-copy">Aucune page trouvée. Essaie « dépenses » ou « patrimoine ».</p>}
        </div>
        <p className="section-copy">Tab pour parcourir · Entrée pour ouvrir · Échap pour fermer</p>
      </Modal>}
    </div>
  );
}
