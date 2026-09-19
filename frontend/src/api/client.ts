export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

let refreshPromise: Promise<boolean> | null = null;

function refreshToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });

  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
    }
  }

  if (res.status === 401) {
    window.location.href = "/";
  }

  return res;

}