import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { scanToCsv } from "./csv.js";
import { runScan, ScanError } from "./scanner.js";
import { getScan, isValidScanId, listScans, runDemoScan, saveScan, toSummary } from "./storage.js";

const app = express();
app.use(express.json());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let scanInProgress = false;

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    demoMode: config.demoMode,
    region: config.region,
    scanAllRegions: config.scanAllRegions,
    usdToInr: config.usdToInr,
    readOnly: true,
  });
});

app.post("/api/scan", async (_req, res, next) => {
  if (scanInProgress) return sendError(res, 409, "SCAN_IN_PROGRESS", "A scan is already running. Wait for it to finish.");
  scanInProgress = true;
  try {
    if (config.demoMode) {
      await sleep(1200); // so the loading state is visible during a demo
      res.json(await runDemoScan());
      return;
    }
    const scan = await runScan({
      region: config.region,
      scanAllRegions: config.scanAllRegions,
      idleCpuThreshold: config.idleCpuThreshold,
      snapshotAgeDays: config.snapshotAgeDays,
    });
    await saveScan(scan);
    res.json(scan);
  } catch (err) {
    if (err instanceof ScanError) {
      const status = err.code === "ACCESS_DENIED" ? 403 : err.code === "THROTTLED" ? 429 : 503;
      sendError(res, status, err.code, err.message);
      return;
    }
    next(err);
  } finally {
    scanInProgress = false;
  }
});

app.get("/api/scans", async (_req, res, next) => {
  try {
    res.json((await listScans()).map(toSummary));
  } catch (err) {
    next(err);
  }
});

app.get("/api/scans/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isValidScanId(id)) return sendError(res, 400, "BAD_ID", "Invalid scan id.");
    const scan = await getScan(id);
    if (!scan) return sendError(res, 404, "NOT_FOUND", `Scan ${id} not found.`);
    res.json(scan);
  } catch (err) {
    next(err);
  }
});

app.get("/api/scans/:id/report.csv", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!isValidScanId(id)) return sendError(res, 400, "BAD_ID", "Invalid scan id.");
    const scan = await getScan(id);
    if (!scan) return sendError(res, 404, "NOT_FOUND", `Scan ${id} not found.`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cloudsaver-${id}.csv"`);
    res.send(scanToCsv(scan, config.usdToInr));
  } catch (err) {
    next(err);
  }
});

app.use("/api", (_req, res) => sendError(res, 404, "NOT_FOUND", "Unknown API route."));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  sendError(res, 500, "INTERNAL", err instanceof Error ? err.message : "Internal server error");
});

app.listen(config.port, () => {
  console.log(
    `CloudSaver API on http://localhost:${config.port}  region=${config.region}` +
      `${config.scanAllRegions ? " (all regions)" : ""}  demo=${config.demoMode}  read-only`,
  );
});
