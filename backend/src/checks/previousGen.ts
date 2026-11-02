import { ec2Monthly, NEXT_GEN_FAMILY, round2, splitInstanceType } from "../pricing.js";
import type { Finding } from "../types.js";
import { listInstances } from "./ec2.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

export const previousGen: CheckDefinition = {
  checkType: "previous-generation",
  label: "Previous-generation instance types",
  async run({ region, clients }) {
    const instances = await listInstances(clients, ["running", "stopped"]);
    const findings: Finding[] = [];
    for (const inst of instances) {
      const id = inst.InstanceId;
      const type = inst.InstanceType;
      if (!id || !type) continue;
      const { family, size } = splitInstanceType(type);
      const next = NEXT_GEN_FAMILY[family];
      if (!next) continue;

      const target = `${next.x86}.${size}`;
      const graviton = next.graviton ? `${next.graviton}.${size}` : undefined;
      const current = ec2Monthly(type);
      const targetCost = ec2Monthly(target);
      const gravitonCost = graviton ? ec2Monthly(graviton) : undefined;
      const running = inst.State?.Name === "running";
      const saving = running && current !== undefined && targetCost !== undefined ? Math.max(0, round2(current - targetCost)) : 0;

      const priceInfo =
        current !== undefined && targetCost !== undefined
          ? ` ${type} is ${usd(current)}/month vs ${target} at ${usd(targetCost)}/month` +
            (gravitonCost !== undefined ? ` (or ${graviton} on Graviton/ARM at ${usd(gravitonCost)}/month)` : "") + "."
          : " Price for one of these types is not in the pricing table.";

      findings.push({
        id: findingId("previous-generation", region, id),
        checkType: "previous-generation",
        resourceId: id,
        resourceName: nameTag(inst.Tags),
        region,
        details: `Instance (${inst.State?.Name}) runs previous-generation type ${type}.${priceInfo} Newer generations give better performance per dollar.` +
          (running ? "" : " Instance is stopped, so the saving applies once it runs again."),
        estimatedMonthlyCostUSD: saving,
        severity: saving >= 10 ? "medium" : "low",
        recommendation:
          `Move to ${target}` + (graviton ? `, or ${graviton} if the software supports ARM64 (about 20% cheaper)` : "") +
          `. ${family === "t2" ? "t3 also uses unlimited burst mode by default; check CPU credits. " : ""}Requires a stop/start; check ENA/NVMe driver support on old AMIs.`,
        awsCliFixCommand:
          `aws ec2 stop-instances --instance-ids ${id} --region ${region} && \\\n  ` +
          `aws ec2 wait instance-stopped --instance-ids ${id} --region ${region} && \\\n  ` +
          `aws ec2 modify-instance-attribute --instance-id ${id} --instance-type Value=${target} --region ${region} && \\\n  ` +
          `aws ec2 start-instances --instance-ids ${id} --region ${region}`,
      });
    }
    return findings;
  },
};
