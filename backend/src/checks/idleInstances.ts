import { GetMetricDataCommand, type MetricDataQuery } from "@aws-sdk/client-cloudwatch";
import { ec2Monthly, oneSizeDown, round2 } from "../pricing.js";
import type { Finding } from "../types.js";
import { listInstances } from "./ec2.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

const DAYS = 7;

/** Average CPUUtilization per instance over the last 7 days, using one GetMetricData call per 500 instances. */
async function averageCpu(cw: import("@aws-sdk/client-cloudwatch").CloudWatchClient, instanceIds: string[]): Promise<Map<string, number>> {
  const end = new Date();
  const start = new Date(end.getTime() - DAYS * 86_400_000);
  const result = new Map<string, number>();

  for (let i = 0; i < instanceIds.length; i += 500) {
    const batch = instanceIds.slice(i, i + 500);
    const queries: MetricDataQuery[] = batch.map((id, idx) => ({
      Id: `m${idx}`,
      MetricStat: {
        Metric: { Namespace: "AWS/EC2", MetricName: "CPUUtilization", Dimensions: [{ Name: "InstanceId", Value: id }] },
        Period: 3600,
        Stat: "Average",
      },
    }));
    const sums = new Map<string, { sum: number; n: number }>();
    let nextToken: string | undefined;
    do {
      const res = await cw.send(new GetMetricDataCommand({ StartTime: start, EndTime: end, MetricDataQueries: queries, NextToken: nextToken }));
      for (const r of res.MetricDataResults ?? []) {
        const idx = Number((r.Id ?? "").slice(1));
        const id = batch[idx];
        if (!id) continue;
        const acc = sums.get(id) ?? { sum: 0, n: 0 };
        for (const v of r.Values ?? []) { acc.sum += v; acc.n += 1; }
        sums.set(id, acc);
      }
      nextToken = res.NextToken;
    } while (nextToken);
    for (const [id, { sum, n }] of sums) if (n > 0) result.set(id, sum / n);
  }
  return result;
}

export const idleInstances: CheckDefinition = {
  checkType: "idle-instance",
  label: "Idle / oversized EC2 instances",
  async run({ region, clients, idleCpuThreshold }) {
    const instances = await listInstances(clients, ["running"]);
    if (instances.length === 0) return [];
    const ids = instances.map((i) => i.InstanceId).filter((v): v is string => !!v);
    const cpu = await averageCpu(clients.cloudwatch, ids);

    const findings: Finding[] = [];
    for (const inst of instances) {
      const id = inst.InstanceId;
      const type = inst.InstanceType;
      if (!id || !type) continue;
      const avg = cpu.get(id);
      if (avg === undefined || avg >= idleCpuThreshold) continue;

      const current = ec2Monthly(type);
      const target = oneSizeDown(type);
      const targetCost = target ? ec2Monthly(target) : undefined;
      const saving = current !== undefined && targetCost !== undefined ? round2(current - targetCost) : undefined;
      const avgStr = avg.toFixed(1);

      let details = `${type} averaged ${avgStr}% CPU over the last ${DAYS} days (threshold ${idleCpuThreshold}%).`;
      let recommendation: string;
      let fix: string;
      if (target && saving !== undefined && current !== undefined && targetCost !== undefined) {
        details += ` Current ${usd(current)}/month, ${target} would be ${usd(targetCost)}/month.`;
        recommendation = `Right-size ${type} -> ${target} (saves about ${usd(saving)}/month). Check memory and network usage first, since CPU alone does not tell the whole story. If it averages under 2%, consider stopping it or moving it to a scheduled start/stop.`;
        fix =
          `aws ec2 stop-instances --instance-ids ${id} --region ${region} && \\\n  ` +
          `aws ec2 wait instance-stopped --instance-ids ${id} --region ${region} && \\\n  ` +
          `aws ec2 modify-instance-attribute --instance-id ${id} --instance-type Value=${target} --region ${region} && \\\n  ` +
          `aws ec2 start-instances --instance-ids ${id} --region ${region}`;
      } else {
        details += current === undefined ? " Price for this instance type is not in the pricing table." : " Already the smallest size in this family.";
        recommendation = "The instance is barely used. Confirm with the owner, then stop it, schedule it (Instance Scheduler), or move the workload to Lambda/Fargate.";
        fix = `aws ec2 stop-instances --instance-ids ${id} --region ${region}`;
      }

      findings.push({
        id: findingId("idle-instance", region, id),
        checkType: "idle-instance",
        resourceId: id,
        resourceName: nameTag(inst.Tags),
        region,
        details,
        estimatedMonthlyCostUSD: saving ?? 0,
        severity: avg < 2 || (saving ?? 0) >= 20 ? "high" : "medium",
        recommendation,
        awsCliFixCommand: fix,
      });
    }
    return findings;
  },
};
