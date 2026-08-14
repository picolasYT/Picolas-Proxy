import {
  ProxyStatus,
  ProxyConfigSafe,
  SecurityConfig,
  DeviceConnection,
  TrafficSample,
  LogEntry,
} from "./types";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include",
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ ok: boolean; user: string }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: string }>("/auth/me"),

  getStatus: () => request<ProxyStatus>("/status"),
  startProxy: () => request<{ ok: boolean; running: boolean }>("/proxy/start", { method: "POST" }),
  stopProxy: () => request<{ ok: boolean; running: boolean }>("/proxy/stop", { method: "POST" }),
  restartProxy: () => request<{ ok: boolean; running: boolean }>("/proxy/restart", { method: "POST" }),

  getProxyConfig: () => request<{ proxy: ProxyConfigSafe }>("/proxy/config"),
  updateProxyConfig: (body: Partial<ProxyConfigSafe> & { newPassword?: string }) =>
    request<{ ok: boolean; proxy: ProxyConfigSafe }>("/proxy/config", { method: "PUT", body: JSON.stringify(body) }),

  getSecurity: () => request<SecurityConfig>("/security"),
  updateSecurity: (body: Partial<SecurityConfig>) =>
    request<{ ok: boolean; security: SecurityConfig }>("/security", { method: "PUT", body: JSON.stringify(body) }),
  addAllowlist: (ip: string) => request<{ ok: boolean; security: SecurityConfig }>("/security/allowlist/add", { method: "POST", body: JSON.stringify({ ip }) }),
  removeAllowlist: (ip: string) => request<{ ok: boolean; security: SecurityConfig }>("/security/allowlist/remove", { method: "POST", body: JSON.stringify({ ip }) }),
  addBlocklist: (ip: string) => request<{ ok: boolean; security: SecurityConfig }>("/security/blocklist/add", { method: "POST", body: JSON.stringify({ ip }) }),
  removeBlocklist: (ip: string) => request<{ ok: boolean; security: SecurityConfig }>("/security/blocklist/remove", { method: "POST", body: JSON.stringify({ ip }) }),

  getDevices: () => request<{ devices: DeviceConnection[] }>("/devices"),
  disconnectDevice: (id: string) => request<{ ok: boolean }>(`/devices/${id}/disconnect`, { method: "POST" }),

  getTraffic: () => request<{ history: TrafficSample[]; totalBytesUp: number; totalBytesDown: number }>("/traffic"),
  getLogs: () => request<{ logs: LogEntry[] }>("/logs"),
};

export { ApiError };
