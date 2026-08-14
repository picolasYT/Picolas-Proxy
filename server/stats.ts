import os from "os";
import { DeviceConnection, TrafficSample } from "./types";

const MAX_TRAFFIC_SAMPLES = 120; // ~ últimos 2 minutos a 1 muestra/seg, o más según intervalo

class StatsStore {
  activeConnections = new Map<string, DeviceConnection>();
  totalConnectionsCount = 0;
  totalBytesUp = 0;
  totalBytesDown = 0;
  startedAt: number | null = null;
  trafficHistory: TrafficSample[] = [];

  private lastSampleBytesUp = 0;
  private lastSampleBytesDown = 0;

  reset() {
    this.activeConnections.clear();
    this.totalConnectionsCount = 0;
    this.totalBytesUp = 0;
    this.totalBytesDown = 0;
    this.trafficHistory = [];
    this.lastSampleBytesUp = 0;
    this.lastSampleBytesDown = 0;
  }

  markStarted() {
    this.startedAt = Date.now();
  }

  markStopped() {
    this.startedAt = null;
    this.activeConnections.clear();
  }

  addConnection(conn: DeviceConnection) {
    this.activeConnections.set(conn.id, conn);
    this.totalConnectionsCount += 1;
  }

  removeConnection(id: string) {
    this.activeConnections.delete(id);
  }

  addBytesUp(id: string, n: number) {
    this.totalBytesUp += n;
    const c = this.activeConnections.get(id);
    if (c) {
      c.bytesUp += n;
      c.lastActivityAt = Date.now();
    }
  }

  addBytesDown(id: string, n: number) {
    this.totalBytesDown += n;
    const c = this.activeConnections.get(id);
    if (c) {
      c.bytesDown += n;
      c.lastActivityAt = Date.now();
    }
  }

  sampleTraffic() {
    const sample: TrafficSample = {
      timestamp: Date.now(),
      bytesUp: this.totalBytesUp - this.lastSampleBytesUp,
      bytesDown: this.totalBytesDown - this.lastSampleBytesDown,
    };
    this.lastSampleBytesUp = this.totalBytesUp;
    this.lastSampleBytesDown = this.totalBytesDown;
    this.trafficHistory.push(sample);
    if (this.trafficHistory.length > MAX_TRAFFIC_SAMPLES) this.trafficHistory.shift();
    return sample;
  }

  uptimeSeconds(): number {
    if (!this.startedAt) return 0;
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}

export const statsStore = new StatsStore();

// --- CPU / RAM reales del proceso/host (sin dependencias externas) ---

let prevCpuInfo = os.cpus();

export function sampleCpuPercent(): number {
  const current = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;
  for (let i = 0; i < current.length; i++) {
    const prev = prevCpuInfo[i]?.times;
    const cur = current[i].times;
    if (!prev) continue;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const curTotal = cur.user + cur.nice + cur.sys + cur.idle + cur.irq;
    totalDiff += curTotal - prevTotal;
    idleDiff += cur.idle - prev.idle;
  }
  prevCpuInfo = current;
  if (totalDiff <= 0) return 0;
  const usage = 1 - idleDiff / totalDiff;
  return Math.max(0, Math.min(100, Math.round(usage * 1000) / 10));
}

export function sampleMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    memPercent: Math.round((used / total) * 1000) / 10,
    memUsedMb: Math.round(used / (1024 * 1024)),
    memTotalMb: Math.round(total / (1024 * 1024)),
  };
}
