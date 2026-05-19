import { useEffect, useState } from "react";
import { getApiBaseUrl, getStoredApiKey, setStoredApiKey } from "../api/client";

const apiBaseUrl = getApiBaseUrl();

type SettingsPageProps = {
  brocanteFocusMode: boolean;
  onToggleBrocanteFocusMode: (value: boolean) => void;
  onLogout: () => void;
};

export function SettingsPage({ brocanteFocusMode, onToggleBrocanteFocusMode, onLogout }: SettingsPageProps) {
  const frontendUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    setApiKey(getStoredApiKey());
  }, []);

  return (
    <main className="page-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Réglages</p>
          <h1>Paramètres</h1>
          <p>Les infos utiles pour lancer l'app, vérifier les URLs et garder la stack propre sous la main.</p>
        </div>
      </header>

      <section className="settings-grid">
        <section className="panel settings-card">
          <div className="section-title">Environnement actuel</div>
          <div className="strategy-row">
            <span>Frontend</span>
            <strong>{frontendUrl}</strong>
          </div>
          <div className="strategy-row">
            <span>API</span>
            <strong>{apiBaseUrl}</strong>
          </div>
          <div className="strategy-row">
            <span>Base attendue</span>
            <strong>PostgreSQL</strong>
          </div>
          <div className="strategy-row">
            <span>Auth API</span>
            <strong>{apiKey ? "Clé configurée" : "Clé non configurée"}</strong>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Commandes rapides</div>
          <div className="settings-command">
            <span>Backend</span>
            <code>cd backend && source .venv/bin/activate && uvicorn app.main:app --reload</code>
          </div>
          <div className="settings-command">
            <span>Frontend</span>
            <code>cd frontend && npm run dev</code>
          </div>
          <div className="settings-command">
            <span>Init DB</span>
            <code>psql "$MY_FIN_APPS_DB_URL" -f init.sql</code>
          </div>
        </section>
      </section>

      <section className="settings-grid">
        <section className="panel settings-card">
          <div className="section-title">Clé API</div>
          <p className="settings-copy">
            Pour protéger l'app quand `MY_FIN_APPS_API_KEY` est activée côté backend, renseigne ici la même valeur côté navigateur.
          </p>
          <label>
            Clé API
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Colle ta clé API"
            />
          </label>
          <div className="modal-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setStoredApiKey("");
                setApiKey("");
              }}
            >
              Vider
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => setStoredApiKey(apiKey)}
            >
              Enregistrer
            </button>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Session</div>
          <p className="settings-copy">
            Déconnecte-toi ici pour tester un autre compte ou changer d'utilisateur sur cette machine.
          </p>
          <button className="ghost-button" type="button" onClick={onLogout}>
            Se déconnecter
          </button>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Navigation</div>
          <p className="settings-copy">
            Active un mode focus si tu veux afficher uniquement <strong>Stock brocante</strong> dans le menu de gauche.
          </p>
          <div className="settings-toggle-row">
            <span>{brocanteFocusMode ? "Mode focus brocante actif" : "Menu complet actif"}</span>
            <button
              className={brocanteFocusMode ? "primary-button" : "ghost-button"}
              type="button"
              onClick={() => onToggleBrocanteFocusMode(!brocanteFocusMode)}
            >
              {brocanteFocusMode ? "Désactiver" : "Activer"}
            </button>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Organisation de l'app</div>
          <ul className="settings-list">
            <li>Dashboard pour la vision globale revenus, dépenses, achat-revente et patrimoine.</li>
            <li>Dépenses pour piloter le cashflow et les sorties mensuelles.</li>
            <li>Achat-revente pour les pièces unitaires et la performance par article.</li>
            <li>Stock brocante pour le stock agrégé et le binder.</li>
            <li>Patrimoine pour cash, actions, ETF, crypto et actifs physiques.</li>
          </ul>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Notes utiles</div>
          <ul className="settings-list">
            <li>Les pages utilisent la même base Postgres que la version historique.</li>
            <li>Si une nouvelle table ou colonne est ajoutée, relance `init.sql` sans crainte sur l'existant.</li>
            <li>Pour les actifs cotés, privilégie les tickers Yahoo cohérents avec ta devise.</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
