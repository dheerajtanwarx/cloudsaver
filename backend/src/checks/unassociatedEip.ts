import { DescribeAddressesCommand } from "@aws-sdk/client-ec2";
import { PUBLIC_IPV4_MONTHLY } from "../pricing.js";
import type { Finding } from "../types.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

export const unassociatedEip: CheckDefinition = {
  checkType: "unassociated-eip",
  label: "Unassociated Elastic IPs",
  async run({ region, clients }) {
    const res = await clients.ec2.send(new DescribeAddressesCommand({}));
    const findings: Finding[] = [];
    for (const a of res.Addresses ?? []) {
      if (a.AssociationId || a.InstanceId || a.NetworkInterfaceId) continue;
      const id = a.AllocationId ?? a.PublicIp ?? "unknown";
      findings.push({
        id: findingId("unassociated-eip", region, id),
        checkType: "unassociated-eip",
        resourceId: id,
        resourceName: nameTag(a.Tags) || (a.PublicIp ?? ""),
        region,
        details: `Elastic IP ${a.PublicIp} is allocated but not attached to anything. AWS bills every public IPv4 address hourly: ${usd(PUBLIC_IPV4_MONTHLY)}/month.`,
        estimatedMonthlyCostUSD: PUBLIC_IPV4_MONTHLY,
        severity: "medium",
        recommendation: "Release the Elastic IP if no DNS record or allow-list depends on it.",
        awsCliFixCommand: a.AllocationId
          ? `aws ec2 release-address --allocation-id ${a.AllocationId} --region ${region}`
          : `aws ec2 release-address --public-ip ${a.PublicIp} --region ${region}`,
      });
    }
    return findings;
  },
};
