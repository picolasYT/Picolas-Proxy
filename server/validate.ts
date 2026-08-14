import { ProxyMode } from "./types";
import { isValidIpOrCidr } from "./security";

export function isValidPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 65536;
}

export function isValidProxyMode(value: unknown): value is ProxyMode {
  return value === "http" || value === "socks5" || value === "both";
}

export function isNonEmptyString(value: unknown, maxLen = 256): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLen;
}

export function isValidIpList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string" && isValidIpOrCidr(v.trim()));
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
