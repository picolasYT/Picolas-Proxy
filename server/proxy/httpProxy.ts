import http from "http";
import net from "net";
import crypto from "crypto";
import { AppConfig, DeviceConnection } from "../types";
import { statsStore } from "../stats";
import { log } from "../logger";
import { evaluateAccess } from "../security";
import { checkProxyCredentials } from "./credentials";

function unauthorized(socket: net.Socket) {
  socket.write("HTTP/1.1 407 Proxy Authentication Required\r\n" + 'Proxy-Authenticate: Basic realm="Picolas Proxy"\r\n' + "Connection: close\r\n\r\n");
  socket.destroy();
}

function forbidden(socket: net.Socket, reason: string) {
  socket.write(`HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\nPicolas Proxy: acceso denegado (${reason})`);
  socket.destroy();
}

function checkAuthHeader(headerValue: string | undefined): boolean {
  if (!headerValue || !headerValue.toLowerCase().startsWith("basic ")) return false;
  try {
    const decoded = Buffer.from(headerValue.slice(6), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return false;
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    return checkProxyCredentials(user, pass);
  } catch {
    return false;
  }
}

export function createHttpProxyServer(getConfig: () => AppConfig) {
  const server = http.createServer((req, res) => {
    // Proxy HTTP "plano" (no CONNECT): reenviar la petición al destino real.
    const cfg = getConfig();
    const remoteIp = req.socket.remoteAddress || "unknown";

    const access = evaluateAccess(remoteIp, cfg.security);
    if (!access.allowed) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end(`Picolas Proxy: acceso denegado (${access.reason})`);
      return;
    }

    if (cfg.proxy.authEnabled && !checkAuthHeader(req.headers["proxy-authorization"])) {
      res.writeHead(407, { "Proxy-Authenticate": 'Basic realm="Picolas Proxy"' });
      res.end("Proxy authentication required");
      return;
    }

    if (!req.url || !req.url.startsWith("http")) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Picolas Proxy: petición inválida (se esperaba proxy HTTP absoluto)");
      return;
    }

    const target = new URL(req.url);
    const connId = crypto.randomUUID();
    const conn: DeviceConnection = {
      id: connId,
      remoteAddress: remoteIp,
      remotePort: req.socket.remotePort || 0,
      protocol: "http",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      bytesUp: 0,
      bytesDown: 0,
      targetHost: target.hostname,
      targetPort: Number(target.port) || 80,
    };
    statsStore.addConnection(conn);
    log.info("http-proxy", `${remoteIp} -> ${target.hostname}:${conn.targetPort} (${req.method})`);

    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: target.pathname + target.search,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.on("data", (chunk: Buffer) => statsStore.addBytesDown(connId, chunk.length));
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      log.warn("http-proxy", `Error reenviando a ${target.hostname}: ${err.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end("Bad gateway");
      statsStore.removeConnection(connId);
    });

    req.on("data", (chunk: Buffer) => statsStore.addBytesUp(connId, chunk.length));
    req.pipe(proxyReq);

    res.on("close", () => statsStore.removeConnection(connId));
  });

  // Método CONNECT: túnel TCP crudo, típico para HTTPS a través del proxy.
  server.on("connect", (req, clientSocket, head) => {
    const cfg = getConfig();
    const remoteIp = clientSocket.remoteAddress || "unknown";

    const access = evaluateAccess(remoteIp, cfg.security);
    if (!access.allowed) {
      forbidden(clientSocket, access.reason || "denegado");
      return;
    }

    if (cfg.proxy.authEnabled && !checkAuthHeader(req.headers["proxy-authorization"])) {
      unauthorized(clientSocket);
      return;
    }

    const [host, portStr] = (req.url || "").split(":");
    const port = Number(portStr) || 443;
    if (!host) {
      clientSocket.destroy();
      return;
    }

    const connId = crypto.randomUUID();
    const conn: DeviceConnection = {
      id: connId,
      remoteAddress: remoteIp,
      remotePort: clientSocket.remotePort || 0,
      protocol: "http",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      bytesUp: 0,
      bytesDown: 0,
      targetHost: host,
      targetPort: port,
    };
    statsStore.addConnection(conn);
    log.info("http-proxy", `CONNECT ${remoteIp} -> ${host}:${port}`);

    const serverSocket = net.connect(port, host, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\nProxy-Agent: Picolas-Proxy\r\n\r\n");
      if (head && head.length) serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on("data", (chunk: Buffer) => statsStore.addBytesDown(connId, chunk.length));
    clientSocket.on("data", (chunk: Buffer) => statsStore.addBytesUp(connId, chunk.length));

    const cleanup = () => {
      statsStore.removeConnection(connId);
      serverSocket.destroy();
      clientSocket.destroy();
    };

    serverSocket.on("error", (err) => {
      log.warn("http-proxy", `Error de túnel hacia ${host}:${port}: ${err.message}`);
      cleanup();
    });
    clientSocket.on("error", cleanup);
    serverSocket.on("close", cleanup);
    clientSocket.on("close", cleanup);
  });

  return server;
}
