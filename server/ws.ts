import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer, IncomingMessage } from "http";
import cookie from "cookie";
import { onLog } from "./logger";
import { statsStore, sampleCpuPercent, sampleMemory } from "./stats";
import { proxyManager } from "./proxy/proxyManager";
import { getSessionUser } from "./auth";

const STATS_INTERVAL_MS = 2000;

export function attachWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (!req.url?.startsWith("/ws")) return;

    // Reutilizamos la misma cookie de sesión del panel para autenticar el WebSocket.
    const user = getSessionUser(req as any);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    const unsubscribe = onLog((entry) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "log", data: entry }));
      }
    });

    const statsInterval = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return;
      const sample = statsStore.sampleTraffic();
      const mem = sampleMemory();
      ws.send(
        JSON.stringify({
          type: "stats",
          data: {
            running: proxyManager.running,
            activeConnections: statsStore.activeConnections.size,
            totalConnections: statsStore.totalConnectionsCount,
            bytesUp: statsStore.totalBytesUp,
            bytesDown: statsStore.totalBytesDown,
            uptimeSeconds: statsStore.uptimeSeconds(),
            cpuPercent: sampleCpuPercent(),
            trafficSample: sample,
            ...mem,
          },
        })
      );
    }, STATS_INTERVAL_MS);

    ws.on("close", () => {
      unsubscribe();
      clearInterval(statsInterval);
    });
  });

  return wss;
}
