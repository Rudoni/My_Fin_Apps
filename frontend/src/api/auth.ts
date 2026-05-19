import { apiRequest, setStoredAuthToken } from "./client";

export type AuthUser = {
  user_id: number;
  email: string;
  display_name: string;
  created_at: string;
};

export type AuthSession = {
  token: string;
  expires_at: string;
  user: AuthUser;
};

export function register(payload: { email: string; password: string; display_name: string }) {
  return apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe() {
  return apiRequest<AuthUser>("/auth/me");
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export function persistSession(session: AuthSession) {
  setStoredAuthToken(session.token);
}
