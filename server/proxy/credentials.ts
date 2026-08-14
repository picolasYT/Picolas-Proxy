import crypto from "crypto";
import { loadConfig, hashPassword } from "../config";

export function checkProxyCredentials(username: string, password: string): boolean {
  const cfg = loadConfig();
  if (username !== cfg.proxy.username) return false;
  const computed = hashPassword(password, cfg.proxy.passwordSalt);
  const a = Buffer.from(computed);
  const b = Buffer.from(cfg.proxy.passwordHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
