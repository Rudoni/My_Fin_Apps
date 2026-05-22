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

export function updateMe(payload: { display_name: string }) {
  return apiRequest<AuthUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: { current_password: string; new_password: string }) {
  return apiRequest<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export function logoutOtherSessions() {
  return apiRequest<{ message: string }>("/auth/logout-other-sessions", { method: "POST" });
}

export function persistSession(session: AuthSession) {
  setStoredAuthToken(session.token);
}
