export type ProxyMode = "http" | "socks5" | "both";

export interface ProxyConfig {
  mode: ProxyMode;
  httpPort: number;
  socks5Port: number;
  /** Interfaz de red a la que se hace bind. "auto" detecta la IP local principal. */
  bindInterface: string;
  authEnabled: boolean;
  username: string;
  /** Hash SHA-256 con salt, nunca la contraseña en texto plano. */
  passwordHash: string;
  passwordSalt: string;
  autoStart: boolean;
}

export interface SecurityConfig {
  /**
   * Si es false (por defecto), los servidores proxy sólo aceptan conexiones
   * desde localhost/LAN, nunca desde 0.0.0.0, para no crear un open proxy
   * público por accidente. Debe activarse explícitamente.
   */
  allowExternal: boolean;
  ipAllowlist: string[];
  ipBlocklist: string[];
  /** Si allowlist tiene elementos, sólo esas IPs pueden conectarse. */
  allowlistMode: boolean;
}

export interface AppConfig {
  version: number;
  proxy: ProxyConfig;
  security: SecurityConfig;
}

export type ProxyProtocol = "http" | "socks5";

export interface DeviceConnection {
  id: string;
  remoteAddress: string;
  remotePort: number;
  protocol: ProxyProtocol;
  connectedAt: number;
  lastActivityAt: number;
  bytesUp: number;
  bytesDown: number;
  targetHost?: string;
  targetPort?: number;
  authenticatedUser?: string;
}

export interface TrafficSample {
  timestamp: number;
  bytesUp: number;
  bytesDown: number;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  scope: string;
  message: string;
}

export interface ProxyStatusPayload {
  running: boolean;
  mode: ProxyMode;
  httpPort: number;
  socks5Port: number;
  startedAt: number | null;
  uptimeSeconds: number;
  localIp: string;
  publicIp: string | null;
  os: {
    platform: string;
    release: string;
    arch: string;
    hostname: string;
    isContainer: boolean;
  };
  security: {
    authEnabled: boolean;
    allowExternal: boolean;
    allowlistMode: boolean;
  };
  stats: {
    activeConnections: number;
    totalConnections: number;
    bytesUp: number;
    bytesDown: number;
    cpuPercent: number;
    memPercent: number;
    memUsedMb: number;
    memTotalMb: number;
  };
}
