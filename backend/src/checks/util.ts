import type { Tag } from "@aws-sdk/client-ec2";
import type { RegionClients } from "../aws/clients.js";
import type { CheckType, Finding } from "../types.js";

export interface CheckContext {
  region: string;
  clients: RegionClients;
  idleCpuThreshold: number;
  snapshotAgeDays: number;
}

export interface CheckDefinition {
  checkType: CheckType;
  label: string;
  /** Global checks (S3) run once, not once per region. */
  global?: boolean;
  run: (ctx: CheckContext) => Promise<Finding[]>;
}

export function nameTag(tags: Tag[] | undefined): string {
  return tags?.find((t) => t.Key === "Name")?.Value ?? "";
}

export function findingId(checkType: CheckType, region: string, resourceId: string): string {
  return `${checkType}:${region}:${resourceId}`;
}

export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}
