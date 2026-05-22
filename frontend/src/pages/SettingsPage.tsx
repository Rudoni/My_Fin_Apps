import { FormEvent, useEffect, useState } from "react";
import { AuthUser, changePassword, logoutOtherSessions, updateMe } from "../api/auth";
import { getApiBaseUrl, getStoredApiKey, setStoredApiKey } from "../api/client";

const apiBaseUrl = getApiBaseUrl();

type SettingsPageProps = {
  currentUser: AuthUser | null;
  brocanteFocusMode: boolean;
  onToggleBrocanteFocusMode: (value: boolean) => void;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
};

export function SettingsPage({
  currentUser,
  brocanteFocusMode,
  onToggleBrocanteFocusMode,
  onUserUpdated,
  onLogout,
}: SettingsPageProps) {
  const frontendUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const [apiKey, setApiKey] = useState("");
  const [displayName, setDisplayName] = useState(currentUser?.display_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [closingSessions, setClosingSessions] = useState(false);

  useEffect(() => {
    setApiKey(getStoredApiKey());
  }, []);

  useEffect(() => {
    setDisplayName(currentUser?.display_name ?? "");
  }, [currentUser]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) return;
    setSavingProfile(true);
    setError(null);
    setProfileMessage(null);
    try {
      const updatedUser = await updateMe({ display_name: displayName.trim() });
      onUserUpdated(updatedUser);
      setProfileMessage("Profil mis à jour.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le profil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSecurityMessage(null);
    if (newPassword !== confirmPassword) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setSavingPassword(true);
    try {
      const response = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de changer le mot de passe.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogoutOtherSessions() {
    setClosingSessions(true);
    setError(null);
    setSecurityMessage(null);
    try {
      const response = await logoutOtherSessions();
      setSecurityMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de fermer les autres sessions.");
    } finally {
      setClosingSessions(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="hero compact-hero">
        <div>
          <p className="eyebrow">Compte & réglages</p>
          <h1>Mon espace</h1>
          <p>Tu gères ici ton profil, la sécurité de ton compte et les réglages pratiques de l'app.</p>
        </div>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="settings-grid">
        <section className="panel settings-card">
          <div className="section-title">Profil</div>
          <form className="form-panel" onSubmit={(event) => void handleProfileSubmit(event)}>
            <label>
              Nom affiché
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <div className="strategy-row">
              <span>Email</span>
              <strong>{currentUser?.email ?? "-"}</strong>
            </div>
            <div className="strategy-row">
              <span>Membre depuis</span>
              <strong>{currentUser ? new Date(currentUser.created_at).toLocaleDateString("fr-FR") : "-"}</strong>
            </div>
            {profileMessage ? <div className="success-box">{profileMessage}</div> : null}
            <button className="primary-button" type="submit" disabled={savingProfile}>
              {savingProfile ? "Enregistrement..." : "Enregistrer le profil"}
            </button>
          </form>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Sécurité</div>
          <form className="form-panel" onSubmit={(event) => void handlePasswordSubmit(event)}>
            <label>
              Mot de passe actuel
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <label>
              Nouveau mot de passe
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
            </label>
            <label>
              Confirmer le nouveau mot de passe
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
            </label>
            {securityMessage ? <div className="success-box">{securityMessage}</div> : null}
            <div className="settings-action-stack">
              <button className="primary-button" type="submit" disabled={savingPassword}>
                {savingPassword ? "Mise à jour..." : "Changer le mot de passe"}
              </button>
              <button className="ghost-button" type="button" onClick={() => void handleLogoutOtherSessions()} disabled={closingSessions}>
                {closingSessions ? "Fermeture..." : "Fermer les autres sessions"}
              </button>
              <button className="ghost-button" type="button" onClick={onLogout}>
                Se déconnecter
              </button>
            </div>
          </form>
        </section>
      </section>

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
          <div className="section-title">Clé API</div>
          <p className="settings-copy">
            Si tu actives une clé API partagée côté backend, tu peux la ranger ici côté navigateur.
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
            <button className="primary-button" type="button" onClick={() => setStoredApiKey(apiKey)}>
              Enregistrer
            </button>
          </div>
        </section>

        <section className="panel settings-card">
          <div className="section-title">Navigation</div>
          <p className="settings-copy">
            Active un mode focus si tu veux garder uniquement <strong>Stock brocante</strong> et les réglages sous la main.
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
      </section>
    </main>
  );
}
