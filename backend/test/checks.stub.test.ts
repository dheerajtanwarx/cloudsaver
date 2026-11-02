import assert from "node:assert/strict";
import { EC2Client } from "@aws-sdk/client-ec2";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { S3Client } from "@aws-sdk/client-s3";
import { CHECKS } from "../src/checks/index.js";
import type { RegionClients } from "../src/aws/clients.js";

const days = (n: number) => new Date(Date.now() - n * 86400000);
type Resp = Record<string, unknown>;
const ec2Resp: Record<string, (input: Resp) => Resp> = {
  DescribeVolumesCommand: (i) => {
    const all = [
      { VolumeId: "vol-unatt", Size: 100, VolumeType: "gp2", State: "available", AvailabilityZone: "ap-south-1a", CreateTime: days(40), Tags: [{ Key: "Name", Value: "orphan" }] },
      { VolumeId: "vol-root", Size: 30, VolumeType: "gp3", State: "in-use", Attachments: [{ InstanceId: "i-stopped" }] },
      { VolumeId: "vol-big", Size: 2000, VolumeType: "gp2", State: "in-use", Attachments: [{ InstanceId: "i-idle" }] },
    ];
    const f = (i.Filters as { Name: string; Values: string[] }[] | undefined) ?? [];
    let v = all;
    for (const fl of f) v = v.filter((x) => (fl.Name === "status" ? fl.Values.includes(x.State) : fl.Values.includes(x.VolumeType)));
    if (i.VolumeIds) v = v.filter((x) => (i.VolumeIds as string[]).includes(x.VolumeId));
    return { Volumes: v };
  },
  DescribeSnapshotsCommand: () => ({ Snapshots: [
    { SnapshotId: "snap-old", VolumeId: "vol-root", VolumeSize: 30, StartTime: days(60) },
    { SnapshotId: "snap-orphan", VolumeId: "vol-gone", VolumeSize: 50, StartTime: days(3) },
    { SnapshotId: "snap-new", VolumeId: "vol-root", VolumeSize: 30, StartTime: days(2) },
  ] }),
  DescribeAddressesCommand: () => ({ Addresses: [{ AllocationId: "eipalloc-1", PublicIp: "1.2.3.4" }, { AllocationId: "eipalloc-2", PublicIp: "5.6.7.8", AssociationId: "a-1" }] }),
  DescribeInstancesCommand: (i) => {
    const state = ((i.Filters as { Values: string[] }[])[0]?.Values ?? []);
    const all = [
      { InstanceId: "i-stopped", InstanceType: "t2.medium", State: { Name: "stopped" }, StateTransitionReason: `User initiated (${days(45).toISOString().slice(0, 10)} 10:00:00 GMT)`, BlockDeviceMappings: [{ Ebs: { VolumeId: "vol-root" } }] },
      { InstanceId: "i-idle", InstanceType: "t3.medium", State: { Name: "running" } },
      { InstanceId: "i-busy", InstanceType: "m4.large", State: { Name: "running" } },
    ];
    return { Reservations: [{ Instances: all.filter((x) => state.includes(x.State.Name)) }] };
  },
  DescribeNetworkInterfacesCommand: () => ({ NetworkInterfaces: [
    { NetworkInterfaceId: "eni-1", Attachment: { InstanceId: "i-idle" }, PrivateIpAddresses: [{ Association: { PublicIp: "13.0.0.1", IpOwnerId: "amazon" } }] },
    { NetworkInterfaceId: "eni-2", Attachment: { InstanceId: "i-busy" }, PrivateIpAddresses: [{ Association: { PublicIp: "5.6.7.8", IpOwnerId: "123", AllocationId: "eipalloc-2", AssociationId: "a-1" } }] },
    { NetworkInterfaceId: "eni-3", PrivateIpAddresses: [{}] },
  ] }),
};
const cwResp = (i: Resp) => ({ MetricDataResults: (i.MetricDataQueries as { Id: string; MetricStat: { Metric: { Dimensions: { Value: string }[] } } }[]).map((q) => ({
  Id: q.Id, Values: q.MetricStat.Metric.Dimensions[0]!.Value === "i-idle" ? [2, 4, 3] : [40, 60],
})) });
const s3Resp: Record<string, (i: Resp) => Resp> = {
  ListBucketsCommand: () => ({ Buckets: [{ Name: "no-rules" }, { Name: "good" }, { Name: "versioned" }] }),
  GetBucketLocationCommand: () => ({ LocationConstraint: "ap-south-1" }),
  GetBucketLifecycleConfigurationCommand: (i) => {
    if (i.Bucket === "no-rules") throw Object.assign(new Error("none"), { name: "NoSuchLifecycleConfiguration" });
    if (i.Bucket === "good") return { Rules: [{ Status: "Enabled", NoncurrentVersionExpiration: { NoncurrentDays: 30 } }] };
    return { Rules: [{ Status: "Enabled", Expiration: { Days: 90 } }] };
  },
  GetBucketVersioningCommand: (i) => ({ Status: i.Bucket === "no-rules" ? undefined : "Enabled" }),
};

function stub<T extends { send: unknown }>(client: T, table: Record<string, (i: Resp) => Resp>) {
  (client as { send: unknown }).send = async (cmd: { constructor: { name: string }; input: Resp }) => {
    const h = table[cmd.constructor.name];
    if (!h) throw new Error("unstubbed " + cmd.constructor.name);
    return h(cmd.input);
  };
  return client;
}
const clients: RegionClients = {
  region: "ap-south-1",
  ec2: stub(new EC2Client({ region: "ap-south-1" }), ec2Resp),
  cloudwatch: stub(new CloudWatchClient({ region: "ap-south-1" }), { GetMetricDataCommand: cwResp }),
  s3: stub(new S3Client({ region: "ap-south-1" }), s3Resp),
};
// s3Lifecycle uses clientsFor(bucketRegion) - patch the cache via module
const mod = await import("../src/aws/clients.js");
const real = mod.clientsFor("ap-south-1"); real.s3 = clients.s3;

const results: Record<string, import("../src/types.js").Finding[]> = {};
for (const c of CHECKS) {
  const out = await c.run({ region: "ap-south-1", clients, idleCpuThreshold: 10, snapshotAgeDays: 30 });
  results[c.checkType] = out;
  console.log(`\n== ${c.checkType} (${out.length})`);
  for (const f of out) console.log(`  ${f.severity.padEnd(6)} $${f.estimatedMonthlyCostUSD.toFixed(2).padStart(7)}  ${f.resourceId}  | ${f.details.slice(0, 150)}`);
}

// ---- assertions ----
const ids = (k: string) => (results[k] ?? []).map((f) => f.resourceId).sort();
const cost = (k: string, id: string) => results[k]?.find((f) => f.resourceId === id)?.estimatedMonthlyCostUSD;
assert.deepEqual(ids("unattached-ebs"), ["vol-unatt"]);
assert.equal(cost("unattached-ebs", "vol-unatt"), 11.4); // 100 GB x $0.114
assert.deepEqual(ids("old-snapshot"), ["snap-old", "snap-orphan"]); // snap-new is recent and its volume exists
assert.deepEqual(ids("unassociated-eip"), ["eipalloc-1"]);
assert.equal(cost("unassociated-eip", "eipalloc-1"), 3.65); // $0.005 x 730
assert.equal(cost("stopped-instance", "i-stopped"), 2.74); // 30 GB gp3
assert.deepEqual(ids("idle-instance"), ["i-idle"]); // i-busy averages 50%
assert.equal(cost("idle-instance", "i-idle"), 16.35); // t3.medium -> t3.small
assert.deepEqual(ids("previous-generation"), ["i-busy", "i-stopped"]);
assert.deepEqual(ids("gp2-volume"), ["vol-big"]); // unattached gp2 not double counted
assert.equal(cost("gp2-volume", "vol-big"), 29.1); // includes extra gp3 IOPS
assert.deepEqual(ids("s3-no-lifecycle"), ["no-rules", "versioned"]);
assert.deepEqual(ids("public-ipv4"), ["13.0.0.1", "5.6.7.8"]);
console.log("\nAll check assertions passed.");
