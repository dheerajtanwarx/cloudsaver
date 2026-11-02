import { gp2Volumes } from "./gp2Volumes.js";
import { idleInstances } from "./idleInstances.js";
import { oldSnapshots } from "./oldSnapshots.js";
import { previousGen } from "./previousGen.js";
import { publicIpv4 } from "./publicIpv4.js";
import { s3Lifecycle } from "./s3Lifecycle.js";
import { stoppedInstances } from "./stoppedInstances.js";
import { unassociatedEip } from "./unassociatedEip.js";
import { unattachedEbs } from "./unattachedEbs.js";
import type { CheckDefinition } from "./util.js";

export const CHECKS: CheckDefinition[] = [
  unattachedEbs,
  oldSnapshots,
  unassociatedEip,
  stoppedInstances,
  idleInstances,
  previousGen,
  gp2Volumes,
  s3Lifecycle,
  publicIpv4,
];

export const CHECK_LABELS = Object.fromEntries(CHECKS.map((c) => [c.checkType, c.label]));
export type { CheckDefinition, CheckContext } from "./util.js";
