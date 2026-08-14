export type ProxyMode = "http" | "socks5" | "both";
export type ProxyProtocol = "http" | "socks5";

export interface ProxyStatus {
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

export interface ProxyConfigSafe {
  mode: ProxyMode;
  httpPort: number;
  socks5Port: number;
  bindInterface: string;
  authEnabled: boolean;
  username: string;
  autoStart: boolean;
}

export interface SecurityConfig {
  allowExternal: boolean;
  ipAllowlist: string[];
  ipBlocklist: string[];
  allowlistMode: boolean;
}

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
