import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { scanIdFromDate } from "./scanner.js";
import type { ScanResult, ScanSummary } from "./types.js";

const ID_PATTERN = /^[\w-]+$/;

export function isValidScanId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function toSummary(s: ScanResult): ScanSummary {
  return {
    id: s.id,
    timestamp: s.timestamp,
    accountId: s.accountId,
    regions: s.regions,
    demo: s.demo,
    totalFindings: s.totalFindings,
    highSeverityFindings: s.highSeverityFindings,
    totalEstimatedMonthlyCostUSD: s.totalEstimatedMonthlyCostUSD,
  };
}

// ---------- real scans: data/scans/<id>.json ----------

export async function saveScan(scan: ScanResult): Promise<void> {
  await fs.mkdir(config.scansDir, { recursive: true });
  await fs.writeFile(path.join(config.scansDir, `${scan.id}.json`), JSON.stringify(scan, null, 2));
}

async function readScanFile(file: string): Promise<ScanResult | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as ScanResult;
  } catch {
    return undefined;
  }
}

async function listRealScans(): Promise<ScanResult[]> {
  let files: string[];
  try {
    files = (await fs.readdir(config.scansDir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const scans = await Promise.all(files.map((f) => readScanFile(path.join(config.scansDir, f))));
  return scans.filter((s): s is ScanResult => !!s && !s.demo);
}

// ---------- demo mode: data/demo-scan.json (never touches AWS) ----------

interface DemoFile {
  current: ScanResult;
  history: ScanResult[];
}

let demoRuns: ScanResult[] = [];

async function loadDemo(): Promise<DemoFile> {
  return JSON.parse(await fs.readFile(path.join(config.dataDir, "demo-scan.json"), "utf8")) as DemoFile;
}

/** Simulates a scan: returns the demo "current" scan with a fresh timestamp. Kept in memory only. */
export async function runDemoScan(): Promise<ScanResult> {
  const demo = await loadDemo();
  const now = new Date();
  const scan: ScanResult = { ...demo.current, id: `demo-${scanIdFromDate(now)}`, timestamp: now.toISOString(), demo: true };
  demoRuns = [scan];
  return scan;
}

async function listDemoScans(): Promise<ScanResult[]> {
  const demo = await loadDemo();
  return [...demo.history, ...(demoRuns.length > 0 ? demoRuns : [demo.current])];
}

// ---------- shared ----------

export async function listScans(): Promise<ScanResult[]> {
  const scans = config.demoMode ? await listDemoScans() : await listRealScans();
  return scans.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function getScan(id: string): Promise<ScanResult | undefined> {
  if (!isValidScanId(id)) return undefined;
  return (await listScans()).find((s) => s.id === id);
}
