import { DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { clientsFor, stsClient } from "./aws/clients.js";
import { classifyAwsError } from "./aws/errors.js";
import { CHECKS, type CheckDefinition } from "./checks/index.js";
import { round2 } from "./pricing.js";
import type { CheckTotal, FailedCheck, Finding, ScanResult } from "./types.js";

export interface ScanOptions {
  region: string;
  scanAllRegions: boolean;
  idleCpuThreshold: number;
  snapshotAgeDays: number;
}

/** Thrown when the scan cannot start at all (e.g. no credentials). Per-check failures do NOT throw. */
export class ScanError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ScanError";
  }
}

export function scanIdFromDate(d: Date): string {
  return d.toISOString().replace(/[:.]/g, "-");
}

async function resolveRegions(opts: ScanOptions): Promise<string[]> {
  if (!opts.scanAllRegions) return [opts.region];
  // DescribeRegions without AllRegions returns only regions enabled for this account.
  const res = await clientsFor(opts.region).ec2.send(new DescribeRegionsCommand({}));
  const regions = (res.Regions ?? []).map((r) => r.RegionName).filter((r): r is string => !!r);
  return regions.length > 0 ? regions.sort() : [opts.region];
}

export function summarize(findings: Finding[]): Pick<ScanResult, "totalFindings" | "highSeverityFindings" | "totalEstimatedMonthlyCostUSD" | "totalsByCheckType"> {
  const totals = new Map<string, CheckTotal>();
  for (const c of CHECKS) totals.set(c.checkType, { checkType: c.checkType, label: c.label, findings: 0, estimatedMonthlyCostUSD: 0 });
  for (const f of findings) {
    const t = totals.get(f.checkType);
    if (!t) continue;
    t.findings += 1;
    t.estimatedMonthlyCostUSD = round2(t.estimatedMonthlyCostUSD + f.estimatedMonthlyCostUSD);
  }
  return {
    totalFindings: findings.length,
    highSeverityFindings: findings.filter((f) => f.severity === "high").length,
    totalEstimatedMonthlyCostUSD: round2(findings.reduce((s, f) => s + f.estimatedMonthlyCostUSD, 0)),
    totalsByCheckType: [...totals.values()],
  };
}

/** Runs every check in every region in parallel. Read-only: only Describe/Get/List calls are made. */
export async function runScan(opts: ScanOptions): Promise<ScanResult> {
  const startedAt = new Date();

  let accountId: string;
  try {
    const id = await stsClient(opts.region).send(new GetCallerIdentityCommand({}));
    accountId = id.Account ?? "unknown";
  } catch (err) {
    const c = classifyAwsError(err, "sts:GetCallerIdentity");
    throw new ScanError(c.code, c.message);
  }

  let regions: string[];
  try {
    regions = await resolveRegions(opts);
  } catch (err) {
    const c = classifyAwsError(err, "ec2:DescribeRegions");
    throw new ScanError(c.code, c.message);
  }

  const jobs: { check: CheckDefinition; region: string }[] = [];
  for (const check of CHECKS) {
    if (check.global) jobs.push({ check, region: opts.region });
    else for (const region of regions) jobs.push({ check, region });
  }

  const settled = await Promise.allSettled(
    jobs.map(({ check, region }) =>
      check.run({ region, clients: clientsFor(region), idleCpuThreshold: opts.idleCpuThreshold, snapshotAgeDays: opts.snapshotAgeDays }),
    ),
  );

  const findings: Finding[] = [];
  const failedChecks: FailedCheck[] = [];
  settled.forEach((res, i) => {
    const job = jobs[i];
    if (!job) return;
    if (res.status === "fulfilled") findings.push(...res.value);
    else {
      const c = classifyAwsError(res.reason, job.check.label);
      failedChecks.push({ checkType: job.check.checkType, region: job.region, errorCode: c.code, message: c.message });
    }
  });

  findings.sort((a, b) => b.estimatedMonthlyCostUSD - a.estimatedMonthlyCostUSD);

  return {
    id: scanIdFromDate(startedAt),
    timestamp: startedAt.toISOString(),
    accountId,
    regions,
    demo: false,
    durationMs: Date.now() - startedAt.getTime(),
    ...summarize(findings),
    failedChecks,
    findings,
  };
}
