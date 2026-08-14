import { Router, Request, Response } from "express";
import { loadConfig, updateConfig, hashPassword } from "../config";
import { proxyManager } from "../proxy/proxyManager";
import { statsStore, sampleCpuPercent, sampleMemory } from "../stats";
import { getLocalIp, getPublicIp, getOsInfo } from "../network";
import { getLogs } from "../logger";
import { requireAuth, checkCredentials, createSessionCookie, clearSessionCookie, getSessionUser } from "../auth";
import { isValidPort, isValidProxyMode, isNonEmptyString, isValidIpList, isBoolean } from "../validate";
import { isValidIpOrCidr } from "../security";
import { ProxyStatusPayload } from "../types";
import crypto from "crypto";

export const apiRouter = Router();

// ---------- Auth ----------

apiRouter.post("/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!isNonEmptyString(username) || !isNonEmptyString(password, 512)) {
    return res.status(400).json({ error: "Usuario o contraseña inválidos" });
  }
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
  res.setHeader("Set-Cookie", createSessionCookie(username));
  res.json({ ok: true, user: username });
});

apiRouter.post("/auth/logout", (_req: Request, res: Response) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});

apiRouter.get("/auth/me", (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "No autenticado" });
  res.json({ user });
});

// A partir de aquí, todo requiere sesión iniciada en el panel.
apiRouter.use(requireAuth);

// ---------- Estado / Dashboard ----------

apiRouter.get("/status", async (_req: Request, res: Response) => {
  const cfg = loadConfig();
  const mem = sampleMemory();
  const payload: ProxyStatusPayload = {
    running: proxyManager.running,
    mode: cfg.proxy.mode,
    httpPort: cfg.proxy.httpPort,
    socks5Port: cfg.proxy.socks5Port,
    startedAt: statsStore.startedAt,
    uptimeSeconds: statsStore.uptimeSeconds(),
    localIp: getLocalIp(),
    publicIp: await getPublicIp(),
    os: getOsInfo(),
    security: {
      authEnabled: cfg.proxy.authEnabled,
      allowExternal: cfg.security.allowExternal,
      allowlistMode: cfg.security.allowlistMode,
    },
    stats: {
      activeConnections: statsStore.activeConnections.size,
      totalConnections: statsStore.totalConnectionsCount,
      bytesUp: statsStore.totalBytesUp,
      bytesDown: statsStore.totalBytesDown,
      cpuPercent: sampleCpuPercent(),
      ...mem,
    },
  };
  res.json(payload);
});

// ---------- Control del proxy ----------

apiRouter.post("/proxy/start", async (_req: Request, res: Response) => {
  try {
    await proxyManager.start();
    res.json({ ok: true, running: proxyManager.running });
  } catch (err: any) {
    res.status(500).json({ error: `No se pudo iniciar el proxy: ${err.message}` });
  }
});

apiRouter.post("/proxy/stop", async (_req: Request, res: Response) => {
  await proxyManager.stop();
  res.json({ ok: true, running: proxyManager.running });
});

apiRouter.post("/proxy/restart", async (_req: Request, res: Response) => {
  try {
    await proxyManager.restart();
    res.json({ ok: true, running: proxyManager.running });
  } catch (err: any) {
    res.status(500).json({ error: `No se pudo reiniciar el proxy: ${err.message}` });
  }
});

// ---------- Configuración del proxy ----------

apiRouter.get("/proxy/config", (_req: Request, res: Response) => {
  const cfg = loadConfig();
  // Nunca exponer el hash/salt de la contraseña al frontend.
  const { passwordHash, passwordSalt, ...safeProxy } = cfg.proxy;
  res.json({ proxy: safeProxy });
});

apiRouter.put("/proxy/config", async (req: Request, res: Response) => {
  const body = req.body || {};
  const errors: string[] = [];

  if (body.mode !== undefined && !isValidProxyMode(body.mode)) errors.push("mode inválido");
  if (body.httpPort !== undefined && !isValidPort(body.httpPort)) errors.push("httpPort inválido");
  if (body.socks5Port !== undefined && !isValidPort(body.socks5Port)) errors.push("socks5Port inválido");
  if (body.httpPort !== undefined && body.socks5Port !== undefined && body.httpPort === body.socks5Port) {
    errors.push("httpPort y socks5Port no pueden ser iguales");
  }
  if (body.bindInterface !== undefined && !isNonEmptyString(body.bindInterface, 64)) errors.push("bindInterface inválido");
  if (body.authEnabled !== undefined && !isBoolean(body.authEnabled)) errors.push("authEnabled inválido");
  if (body.username !== undefined && !isNonEmptyString(body.username, 128)) errors.push("username inválido");
  if (body.autoStart !== undefined && !isBoolean(body.autoStart)) errors.push("autoStart inválido");
  if (body.newPassword !== undefined && !isNonEmptyString(body.newPassword, 256)) errors.push("newPassword inválido");

  if (errors.length) return res.status(400).json({ error: errors.join(", ") });

  const cfg = updateConfig((c) => {
    if (body.mode !== undefined) c.proxy.mode = body.mode;
    if (body.httpPort !== undefined) c.proxy.httpPort = body.httpPort;
    if (body.socks5Port !== undefined) c.proxy.socks5Port = body.socks5Port;
    if (body.bindInterface !== undefined) c.proxy.bindInterface = body.bindInterface;
    if (body.authEnabled !== undefined) c.proxy.authEnabled = body.authEnabled;
    if (body.username !== undefined) c.proxy.username = body.username;
    if (body.autoStart !== undefined) c.proxy.autoStart = body.autoStart;
    if (body.newPassword) {
      const salt = crypto.randomBytes(16).toString("hex");
      c.proxy.passwordSalt = salt;
      c.proxy.passwordHash = hashPassword(body.newPassword, salt);
    }
  });

  const { passwordHash, passwordSalt, ...safeProxy } = cfg.proxy;
  res.json({ ok: true, proxy: safeProxy, note: "Reinicia el proxy para aplicar cambios de puerto/modo." });
});

// ---------- Seguridad ----------

apiRouter.get("/security", (_req: Request, res: Response) => {
  const cfg = loadConfig();
  res.json(cfg.security);
});

apiRouter.put("/security", (req: Request, res: Response) => {
  const body = req.body || {};
  const errors: string[] = [];

  if (body.allowExternal !== undefined && !isBoolean(body.allowExternal)) errors.push("allowExternal inválido");
  if (body.allowlistMode !== undefined && !isBoolean(body.allowlistMode)) errors.push("allowlistMode inválido");
  if (body.ipAllowlist !== undefined && !isValidIpList(body.ipAllowlist)) errors.push("ipAllowlist inválida");
  if (body.ipBlocklist !== undefined && !isValidIpList(body.ipBlocklist)) errors.push("ipBlocklist inválida");

  if (errors.length) return res.status(400).json({ error: errors.join(", ") });

  const cfg = updateConfig((c) => {
    if (body.allowExternal !== undefined) c.security.allowExternal = body.allowExternal;
    if (body.allowlistMode !== undefined) c.security.allowlistMode = body.allowlistMode;
    if (body.ipAllowlist !== undefined) c.security.ipAllowlist = body.ipAllowlist.map((v: string) => v.trim());
    if (body.ipBlocklist !== undefined) c.security.ipBlocklist = body.ipBlocklist.map((v: string) => v.trim());
  });

  res.json({ ok: true, security: cfg.security });
});

apiRouter.post("/security/allowlist/add", (req: Request, res: Response) => {
  const ip = (req.body?.ip || "").trim();
  if (!isValidIpOrCidr(ip)) return res.status(400).json({ error: "IP/CIDR inválida" });
  const cfg = updateConfig((c) => {
    if (!c.security.ipAllowlist.includes(ip)) c.security.ipAllowlist.push(ip);
  });
  res.json({ ok: true, security: cfg.security });
});

apiRouter.post("/security/blocklist/add", (req: Request, res: Response) => {
  const ip = (req.body?.ip || "").trim();
  if (!isValidIpOrCidr(ip)) return res.status(400).json({ error: "IP/CIDR inválida" });
  const cfg = updateConfig((c) => {
    if (!c.security.ipBlocklist.includes(ip)) c.security.ipBlocklist.push(ip);
  });
  res.json({ ok: true, security: cfg.security });
});

apiRouter.post("/security/allowlist/remove", (req: Request, res: Response) => {
  const ip = (req.body?.ip || "").trim();
  const cfg = updateConfig((c) => {
    c.security.ipAllowlist = c.security.ipAllowlist.filter((v) => v !== ip);
  });
  res.json({ ok: true, security: cfg.security });
});

apiRouter.post("/security/blocklist/remove", (req: Request, res: Response) => {
  const ip = (req.body?.ip || "").trim();
  const cfg = updateConfig((c) => {
    c.security.ipBlocklist = c.security.ipBlocklist.filter((v) => v !== ip);
  });
  res.json({ ok: true, security: cfg.security });
});

// ---------- Dispositivos / conexiones activas ----------

apiRouter.get("/devices", (_req: Request, res: Response) => {
  const devices = Array.from(statsStore.activeConnections.values()).sort((a, b) => b.connectedAt - a.connectedAt);
  res.json({ devices });
});

apiRouter.post("/devices/:id/disconnect", (req: Request, res: Response) => {
  const conn = statsStore.activeConnections.get(req.params.id);
  if (!conn) return res.status(404).json({ error: "Conexión no encontrada" });
  statsStore.removeConnection(req.params.id);
  res.json({ ok: true });
});

// ---------- Tráfico ----------

apiRouter.get("/traffic", (_req: Request, res: Response) => {
  res.json({
    history: statsStore.trafficHistory,
    totalBytesUp: statsStore.totalBytesUp,
    totalBytesDown: statsStore.totalBytesDown,
  });
});

// ---------- Logs ----------

apiRouter.get("/logs", (_req: Request, res: Response) => {
  res.json({ logs: getLogs() });
});
