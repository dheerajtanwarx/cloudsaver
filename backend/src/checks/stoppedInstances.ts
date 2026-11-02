import { ebsMonthly, round2 } from "../pricing.js";
import type { Finding } from "../types.js";
import { describeVolumesById, listInstances } from "./ec2.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

export const stoppedInstances: CheckDefinition = {
  checkType: "stopped-instance",
  label: "Stopped EC2 instances (paying for EBS)",
  async run({ region, clients }) {
    const instances = await listInstances(clients, ["stopped"]);
    const volIds = instances.flatMap((i) => (i.BlockDeviceMappings ?? []).map((b) => b.Ebs?.VolumeId).filter((v): v is string => !!v));
    const volumes = await describeVolumesById(clients, volIds);

    const findings: Finding[] = [];
    for (const inst of instances) {
      if (!inst.InstanceId) continue;
      const attached = (inst.BlockDeviceMappings ?? [])
        .map((b) => (b.Ebs?.VolumeId ? volumes.get(b.Ebs.VolumeId) : undefined))
        .filter((v) => v !== undefined);
      const totalGb = attached.reduce((s, v) => s + (v.Size ?? 0), 0);
      const cost = round2(attached.reduce((s, v) => s + (ebsMonthly(v.VolumeType, v.Size ?? 0) ?? 0), 0));
      // StateTransitionReason looks like "User initiated (2024-05-01 10:00:00 GMT)".
      const since = /\((\d{4}-\d{2}-\d{2})/.exec(inst.StateTransitionReason ?? "")?.[1];
      const stoppedDays = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000) : undefined;

      findings.push({
        id: findingId("stopped-instance", region, inst.InstanceId),
        checkType: "stopped-instance",
        resourceId: inst.InstanceId,
        resourceName: nameTag(inst.Tags),
        region,
        details: `${inst.InstanceType} instance is stopped` +
          (stoppedDays !== undefined ? ` (since ${since}, ${stoppedDays} days)` : "") +
          `. No compute charge, but its ${attached.length} EBS volume(s) totalling ${totalGb} GB still cost ${usd(cost)}/month.`,
        estimatedMonthlyCostUSD: cost,
        severity: stoppedDays !== undefined && stoppedDays > 30 && cost >= 5 ? "high" : "medium",
        recommendation:
          "If the instance is no longer needed, create an AMI as a backup and terminate it. If it is needed occasionally, keep it but consider snapshotting and deleting the volumes between uses.",
        awsCliFixCommand:
          `aws ec2 create-image --instance-id ${inst.InstanceId} --name "${inst.InstanceId}-final-backup" --region ${region} && \\\n  ` +
          `aws ec2 terminate-instances --instance-ids ${inst.InstanceId} --region ${region}`,
      });
    }
    return findings;
  },
};
