import http from "http";
import net from "net";
import { AppConfig } from "../types";
import { loadConfig } from "../config";
import { createHttpProxyServer } from "./httpProxy";
import { createSocks5ProxyServer } from "./socks5Proxy";
import { statsStore } from "../stats";
import { log } from "../logger";
import { getLocalIp } from "../network";

class ProxyManager {
  private httpServer: http.Server | null = null;
  private socksServer: net.Server | null = null;
  private _running = false;

  get running() {
    return this._running;
  }

  private getConfig(): AppConfig {
    return loadConfig();
  }

  private bindHost(cfg: AppConfig): string {
    // Por defecto, los proxies sólo escuchan en localhost salvo que el usuario
    // habilite explícitamente el acceso externo (security.allowExternal).
    // Esto evita crear un open proxy público por accidente.
    if (cfg.security.allowExternal) return "0.0.0.0";
    return "127.0.0.1";
  }

  async start(): Promise<void> {
    if (this._running) return;
    const cfg = this.getConfig();
    const host = this.bindHost(cfg);

    const startHttp = cfg.proxy.mode === "http" || cfg.proxy.mode === "both";
    const startSocks = cfg.proxy.mode === "socks5" || cfg.proxy.mode === "both";

    if (startHttp) {
      this.httpServer = createHttpProxyServer(() => this.getConfig());
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.once("error", reject);
        this.httpServer!.listen(cfg.proxy.httpPort, host, () => resolve());
      });
      log.success("proxy", `Proxy HTTP escuchando en ${host}:${cfg.proxy.httpPort}`);
    }

    if (startSocks) {
      this.socksServer = createSocks5ProxyServer(() => this.getConfig());
      await new Promise<void>((resolve, reject) => {
        this.socksServer!.once("error", reject);
        this.socksServer!.listen(cfg.proxy.socks5Port, host, () => resolve());
      });
      log.success("proxy", `Proxy SOCKS5 escuchando en ${host}:${cfg.proxy.socks5Port}`);
    }

    statsStore.markStarted();
    this._running = true;
    log.success("proxy", `Picolas Proxy iniciado (modo: ${cfg.proxy.mode}, bind: ${host}, IP local: ${getLocalIp()})`);
  }

  async stop(): Promise<void> {
    if (!this._running) return;
    const closers: Promise<void>[] = [];
    if (this.httpServer) {
      const server = this.httpServer;
      closers.push(new Promise((resolve) => server.close(() => resolve())));
    }
    if (this.socksServer) {
      const server = this.socksServer;
      closers.push(new Promise((resolve) => server.close(() => resolve())));
    }
    await Promise.all(closers);
    this.httpServer = null;
    this.socksServer = null;
    this._running = false;
    statsStore.markStopped();
    log.warn("proxy", "Picolas Proxy detenido");
  }

  async restart(): Promise<void> {
    log.info("proxy", "Reiniciando Picolas Proxy...");
    await this.stop();
    await this.start();
  }
}

export const proxyManager = new ProxyManager();
