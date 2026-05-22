import { FormEvent, useState } from "react";
import { AuthUser, login, persistSession, register } from "../api/auth";

type LoginPageProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session =
        mode === "login"
          ? await login({ email, password })
          : await register({ email, password, display_name: displayName });
      persistSession(session);
      onAuthenticated(session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell login-shell">
      <section className="panel form-panel login-panel">
        <p className="eyebrow">My Fin Apps</p>
        <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <p className="section-copy">
          {mode === "login"
            ? "Connecte-toi pour retrouver tes données perso."
            : "Crée ton espace personnel. Si c'est le premier compte, il récupérera aussi les anciennes données locales."}
        </p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          {mode === "register" ? (
            <label>
              Nom affiché
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          {error ? <div className="error-box">{error}</div> : null}
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setMode((current) => (current === "login" ? "register" : "login"))}>
              {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
            </button>
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
