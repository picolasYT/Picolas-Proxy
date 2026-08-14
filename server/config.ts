import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AppConfig } from "./types";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function defaultConfig(): AppConfig {
  const salt = crypto.randomBytes(16).toString("hex");
  const initialPassword = process.env.PANEL_ADMIN_PASSWORD || "change-me-please";
  return {
    version: 1,
    proxy: {
      mode: "http",
      httpPort: 8888,
      socks5Port: 1080,
      bindInterface: "auto",
      authEnabled: true,
      username: process.env.PANEL_ADMIN_USER || "admin",
      passwordHash: hashPassword(initialPassword, salt),
      passwordSalt: salt,
      autoStart: false,
    },
    security: {
      allowExternal: (process.env.ALLOW_EXTERNAL_PROXY || "false").toLowerCase() === "true",
      ipAllowlist: [],
      ipBlocklist: [],
      allowlistMode: false,
    },
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const cfg = defaultConfig();
    saveConfig(cfg);
    cachedConfig = cfg;
    return cfg;
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as AppConfig;
    // Migración simple / relleno de campos faltantes si el esquema cambia.
    cachedConfig = { ...defaultConfig(), ...parsed };
    return cachedConfig;
  } catch (err) {
    // Config corrupta: recuperar con defaults en vez de tumbar el servicio.
    const cfg = defaultConfig();
    saveConfig(cfg);
    cachedConfig = cfg;
    return cfg;
  }
}

export function saveConfig(cfg: AppConfig): void {
  ensureDataDir();
  cachedConfig = cfg;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

export function updateConfig(mutator: (cfg: AppConfig) => void): AppConfig {
  const cfg = loadConfig();
  mutator(cfg);
  saveConfig(cfg);
  return cfg;
}
