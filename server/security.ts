import { SecurityConfig } from "./types";
import { isPrivateOrLoopback } from "./network";

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Decide si una IP puede conectarse al proxy, en base a:
 *  1. Blocklist explícita (siempre gana).
 *  2. Allowlist, si el modo allowlist está activo (sólo esas IPs pasan).
 *  3. Restricción por defecto: si allowExternal es false, sólo se permiten
 *     conexiones desde localhost/LAN, para evitar un open proxy accidental.
 */
export function evaluateAccess(remoteIp: string, security: SecurityConfig): AccessDecision {
  const ip = remoteIp.replace("::ffff:", "");

  if (security.ipBlocklist.includes(ip)) {
    return { allowed: false, reason: "IP bloqueada explícitamente" };
  }

  if (security.allowlistMode) {
    if (security.ipAllowlist.includes(ip)) {
      return { allowed: true };
    }
    return { allowed: false, reason: "IP no está en la lista blanca" };
  }

  if (!security.allowExternal && !isPrivateOrLoopback(ip)) {
    return { allowed: false, reason: "Conexiones externas deshabilitadas (allowExternal=false)" };
  }

  return { allowed: true };
}

export function isValidIpOrCidr(value: string): boolean {
  // Acepta IPv4/IPv6 simples y notación CIDR básica (IPv4).
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv4Cidr = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (ipv4.test(value)) {
    return value.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  if (ipv4Cidr.test(value)) {
    const [ip, mask] = value.split("/");
    return isValidIpOrCidr(ip) && Number(mask) >= 0 && Number(mask) <= 32;
  }
  return ipv6.test(value) && value.includes(":");
}
