import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..", "..");

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Env var ${name} must be a number, got "${raw}"`);
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes"].includes(raw.toLowerCase());
}

export const config = {
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-south-1",
  scanAllRegions: bool("SCAN_ALL_REGIONS", false),
  demoMode: bool("DEMO_MODE", false),
  usdToInr: num("USD_TO_INR", 84),
  idleCpuThreshold: num("IDLE_CPU_THRESHOLD", 10),
  snapshotAgeDays: num("SNAPSHOT_AGE_DAYS", 30),
  port: num("PORT", 4000),
  dataDir: path.join(rootDir, "data"),
  scansDir: path.join(rootDir, "data", "scans"),
} as const;

export type Config = typeof config;
