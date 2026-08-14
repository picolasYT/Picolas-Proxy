import os from "os";
import fs from "fs";
import net from "net";

/** Devuelve la IP local (LAN) principal de la máquina, evitando loopback. */
export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name] || [];
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1";
}

export function listNetworkInterfaces(): { name: string; address: string; family: string }[] {
  const interfaces = os.networkInterfaces();
  const result: { name: string; address: string; family: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const addr of interfaces[name] || []) {
      if (!addr.internal) {
        result.push({ name, address: addr.address, family: addr.family });
      }
    }
  }
  return result;
}

/** Heurística simple para saber si el proceso corre dentro de un contenedor (Docker/Render/etc). */
export function isRunningInContainer(): boolean {
  try {
    if (fs.existsSync("/.dockerenv")) return true;
    if (process.env.RENDER === "true" || !!process.env.RENDER_SERVICE_ID) return true;
    const cgroup = fs.existsSync("/proc/1/cgroup") ? fs.readFileSync("/proc/1/cgroup", "utf-8") : "";
    if (cgroup.includes("docker") || cgroup.includes("kubepods")) return true;
  } catch {
    // ignorar, no es crítico
  }
  return false;
}

export function getOsInfo() {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    isContainer: isRunningInContainer(),
  };
}

/**
 * Intenta obtener la IP pública consultando un servicio externo simple, con timeout corto.
 * Si no hay salida a internet (por ejemplo, en un sandbox aislado), devuelve null sin fallar.
 */
export async function getPublicIp(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}

/** true si la IP pertenece a rangos privados/LAN o es loopback. */
export function isPrivateOrLoopback(ip: string): boolean {
  const cleaned = ip.replace("::ffff:", "");
  if (cleaned === "127.0.0.1" || cleaned === "::1" || cleaned === "localhost") return true;
  if (!net.isIP(cleaned)) return false;
  const parts = cleaned.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}
