// `npm run scan` - run a scan from the terminal and save it, without the dashboard.
import { config } from "./config.js";
import { runScan, ScanError } from "./scanner.js";
import { saveScan } from "./storage.js";

try {
  const scan = await runScan({
    region: config.region,
    scanAllRegions: config.scanAllRegions,
    idleCpuThreshold: config.idleCpuThreshold,
    snapshotAgeDays: config.snapshotAgeDays,
  });
  await saveScan(scan);
  console.log(`Account ${scan.accountId}, regions ${scan.regions.join(", ")}, ${scan.durationMs} ms`);
  console.table(scan.totalsByCheckType.map((t) => ({ check: t.label, findings: t.findings, usdPerMonth: t.estimatedMonthlyCostUSD })));
  console.log(`Total: ${scan.totalFindings} findings, $${scan.totalEstimatedMonthlyCostUSD}/month`);
  for (const f of scan.failedChecks) console.warn(`FAILED ${f.checkType} @ ${f.region}: ${f.message}`);
  console.log(`Saved data/scans/${scan.id}.json`);
} catch (err) {
  console.error(err instanceof ScanError ? `${err.code}: ${err.message}` : err);
  process.exit(1);
}
