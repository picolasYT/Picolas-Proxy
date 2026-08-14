import net from "net";
import dns from "dns";
import crypto from "crypto";
import { AppConfig, DeviceConnection } from "../types";
import { statsStore } from "../stats";
import { log } from "../logger";
import { evaluateAccess } from "../security";
import { checkProxyCredentials } from "./credentials";

const SOCKS_VERSION = 0x05;

enum AuthMethod {
  NoAuth = 0x00,
  UserPass = 0x02,
  NoAcceptable = 0xff,
}

enum Command {
  Connect = 0x01,
}

enum AddressType {
  IPv4 = 0x01,
  Domain = 0x03,
  IPv6 = 0x04,
}

enum ReplyCode {
  Succeeded = 0x00,
  GeneralFailure = 0x01,
  NotAllowed = 0x02,
  NetworkUnreachable = 0x03,
  HostUnreachable = 0x04,
  ConnectionRefused = 0x05,
  CommandNotSupported = 0x07,
  AddressTypeNotSupported = 0x08,
}

function sendReply(socket: net.Socket, code: ReplyCode, addr = "0.0.0.0", port = 0) {
  const addrParts = addr.split(".").map(Number);
  const buf = Buffer.alloc(10);
  buf[0] = SOCKS_VERSION;
  buf[1] = code;
  buf[2] = 0x00;
  buf[3] = AddressType.IPv4;
  buf[4] = addrParts[0] || 0;
  buf[5] = addrParts[1] || 0;
  buf[6] = addrParts[2] || 0;
  buf[7] = addrParts[3] || 0;
  buf.writeUInt16BE(port, 8);
  socket.write(buf);
}

function resolveTarget(atyp: number, buf: Buffer, offset: number): { host: string; nextOffset: number } | null {
  if (atyp === AddressType.IPv4) {
    const host = `${buf[offset]}.${buf[offset + 1]}.${buf[offset + 2]}.${buf[offset + 3]}`;
    return { host, nextOffset: offset + 4 };
  }
  if (atyp === AddressType.Domain) {
    const len = buf[offset];
    const host = buf.toString("utf-8", offset + 1, offset + 1 + len);
    return { host, nextOffset: offset + 1 + len };
  }
  if (atyp === AddressType.IPv6) {
    const bytes = buf.slice(offset, offset + 16);
    const host = bytes.reduce((acc, byte, i) => acc + (i % 2 === 0 && i > 0 ? ":" : "") + byte.toString(16).padStart(2, "0"), "").match(/.{1,4}/g)?.join(":") || "";
    return { host, nextOffset: offset + 16 };
  }
  return null;
}

export function createSocks5ProxyServer(getConfig: () => AppConfig) {
  const server = net.createServer((socket) => {
    const cfg = getConfig();
    const remoteIp = socket.remoteAddress || "unknown";

    const access = evaluateAccess(remoteIp, cfg.security);
    if (!access.allowed) {
      socket.destroy();
      log.warn("socks5", `Conexión rechazada de ${remoteIp}: ${access.reason}`);
      return;
    }

    let stage: "greeting" | "auth" | "request" | "streaming" = "greeting";
    let authenticatedUser: string | undefined;

    socket.once("data", handleGreeting);

    function handleGreeting(data: Buffer) {
      if (data.length < 2 || data[0] !== SOCKS_VERSION) {
        socket.destroy();
        return;
      }
      const nmethods = data[1];
      const methods = data.slice(2, 2 + nmethods);
      const wantsUserPass = methods.includes(AuthMethod.UserPass);
      const wantsNoAuth = methods.includes(AuthMethod.NoAuth);

      const needsAuth = cfg.proxy.authEnabled;

      if (needsAuth && wantsUserPass) {
        socket.write(Buffer.from([SOCKS_VERSION, AuthMethod.UserPass]));
        stage = "auth";
        socket.once("data", handleAuth);
      } else if (!needsAuth && wantsNoAuth) {
        socket.write(Buffer.from([SOCKS_VERSION, AuthMethod.NoAuth]));
        stage = "request";
        socket.once("data", handleRequest);
      } else {
        socket.write(Buffer.from([SOCKS_VERSION, AuthMethod.NoAcceptable]));
        socket.destroy();
      }
    }

    function handleAuth(data: Buffer) {
      if (data.length < 2 || data[0] !== 0x01) {
        socket.destroy();
        return;
      }
      const ulen = data[1];
      const uname = data.toString("utf-8", 2, 2 + ulen);
      const plen = data[2 + ulen];
      const passwd = data.toString("utf-8", 3 + ulen, 3 + ulen + plen);

      const ok = checkProxyCredentials(uname, passwd);
      socket.write(Buffer.from([0x01, ok ? 0x00 : 0x01]));
      if (!ok) {
        log.warn("socks5", `Autenticación fallida para usuario "${uname}" desde ${remoteIp}`);
        socket.destroy();
        return;
      }
      authenticatedUser = uname;
      stage = "request";
      socket.once("data", handleRequest);
    }

    function handleRequest(data: Buffer) {
      if (data.length < 7 || data[0] !== SOCKS_VERSION) {
        sendReply(socket, ReplyCode.GeneralFailure);
        socket.destroy();
        return;
      }
      const cmd = data[1];
      const atyp = data[3];

      if (cmd !== Command.Connect) {
        sendReply(socket, ReplyCode.CommandNotSupported);
        socket.destroy();
        return;
      }

      const resolved = resolveTarget(atyp, data, 4);
      if (!resolved) {
        sendReply(socket, ReplyCode.AddressTypeNotSupported);
        socket.destroy();
        return;
      }
      const port = data.readUInt16BE(resolved.nextOffset);
      const { host } = resolved;

      const connId = crypto.randomUUID();

      const finishConnect = (ip: string) => {
        const target = net.connect(port, ip, () => {
          sendReply(socket, ReplyCode.Succeeded, target.localAddress?.replace("::ffff:", "") || "0.0.0.0", target.localPort || 0);
          stage = "streaming";

          const conn: DeviceConnection = {
            id: connId,
            remoteAddress: remoteIp,
            remotePort: socket.remotePort || 0,
            protocol: "socks5",
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            bytesUp: 0,
            bytesDown: 0,
            targetHost: host,
            targetPort: port,
            authenticatedUser,
          };
          statsStore.addConnection(conn);
          log.info("socks5", `${remoteIp} -> ${host}:${port}${authenticatedUser ? ` (usuario: ${authenticatedUser})` : ""}`);

          socket.on("data", (chunk: Buffer) => statsStore.addBytesUp(connId, chunk.length));
          target.on("data", (chunk: Buffer) => statsStore.addBytesDown(connId, chunk.length));

          socket.pipe(target);
          target.pipe(socket);
        });

        const cleanup = () => {
          statsStore.removeConnection(connId);
          target.destroy();
          socket.destroy();
        };
        target.on("error", (err) => {
          log.warn("socks5", `Error conectando a ${host}:${port}: ${err.message}`);
          if (stage !== "streaming") sendReply(socket, ReplyCode.HostUnreachable);
          cleanup();
        });
        socket.on("error", cleanup);
        target.on("close", cleanup);
        socket.on("close", cleanup);
      };

      if (atyp === AddressType.Domain) {
        dns.lookup(host, (err, address) => {
          if (err) {
            sendReply(socket, ReplyCode.HostUnreachable);
            socket.destroy();
            return;
          }
          finishConnect(address);
        });
      } else {
        finishConnect(host);
      }
    }
  });

  return server;
}
