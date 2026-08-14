import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import cookie from "cookie";
import { loadConfig, hashPassword } from "./config";

const COOKIE_NAME = "picolas_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

interface SessionPayload {
  user: string;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as SessionPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function checkCredentials(username: string, password: string): boolean {
  const cfg = loadConfig();
  if (username !== cfg.proxy.username) return false;
  const computed = hashPassword(password, cfg.proxy.passwordSalt);
  const a = Buffer.from(computed);
  const b = Buffer.from(cfg.proxy.passwordHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSessionCookie(username: string): string {
  const token = sign({ user: username, exp: Date.now() + SESSION_TTL_MS });
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(): string {
  return cookie.serialize(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export function getSessionUser(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parsed = cookie.parse(raw);
  const token = parsed[COOKIE_NAME];
  if (!token) return null;
  const payload = verify(token);
  return payload?.user ?? null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  next();
}
