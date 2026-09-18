export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
}