import path from "path";
import fs from "fs";
import express from "express";
import { apiRouter } from "./routes/api";
import { attachWebSocket } from "./ws";
import { loadConfig } from "./config";
import { proxyManager } from "./proxy/proxyManager";
import { log } from "./logger";
import { getLocalIp, getOsInfo } from "./network";

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "picolas-proxy", timestamp: Date.now() });
});

app.use("/api", apiRouter);

// Servir el frontend compilado (React + Vite) como archivos estáticos.
const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("text/plain").send("Picolas Proxy: build del frontend no encontrado. Ejecuta `npm run build`.");
  });
}

const server = app.listen(PORT, "0.0.0.0", async () => {
  const cfg = loadConfig();
  const os = getOsInfo();
  log.success("server", `Picolas Proxy panel escuchando en 0.0.0.0:${PORT}`);
  log.info("server", `IP local detectada: ${getLocalIp()} | SO: ${os.platform} ${os.release} (${os.arch}) | contenedor: ${os.isContainer}`);

  if (cfg.proxy.autoStart) {
    try {
      await proxyManager.start();
    } catch (err: any) {
      log.error("server", `Fallo al autoiniciar el proxy: ${err.message}`);
    }
  }
});

attachWebSocket(server);

process.on("SIGTERM", async () => {
  log.warn("server", "SIGTERM recibido, cerrando ordenadamente...");
  await proxyManager.stop();
  server.close(() => process.exit(0));
});

process.on("SIGINT", async () => {
  await proxyManager.stop();
  server.close(() => process.exit(0));
});
