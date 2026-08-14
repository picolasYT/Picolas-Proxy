import { useEffect, useRef, useState } from "react";
import { LogEntry } from "./types";

export interface LiveStats {
  running: boolean;
  activeConnections: number;
  totalConnections: number;
  bytesUp: number;
  bytesDown: number;
  uptimeSeconds: number;
  cpuPercent: number;
  memPercent: number;
  memUsedMb: number;
  memTotalMb: number;
  trafficSample: { timestamp: number; bytesUp: number; bytesDown: number };
}

export function useLiveSocket() {
  const [connected, setConnected] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => !cancelled && setConnected(true);
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "stats") setLiveStats(msg.data);
          if (msg.type === "log") setLiveLogs((prev) => [...prev.slice(-199), msg.data]);
        } catch {
          // ignorar mensajes malformados
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  }, []);

  return { connected, liveStats, liveLogs };
}
