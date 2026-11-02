import { paginateDescribeNetworkInterfaces } from "@aws-sdk/client-ec2";
import { PUBLIC_IPV4_MONTHLY } from "../pricing.js";
import type { Finding } from "../types.js";
import { type CheckDefinition, findingId, nameTag, usd } from "./util.js";

export const publicIpv4: CheckDefinition = {
  checkType: "public-ipv4",
  label: "Public IPv4 addresses in use",
  async run({ region, clients }) {
    const findings: Finding[] = [];
    for await (const page of paginateDescribeNetworkInterfaces({ client: clients.ec2 }, {})) {
      for (const eni of page.NetworkInterfaces ?? []) {
        if (!eni.NetworkInterfaceId) continue;
        for (const priv of eni.PrivateIpAddresses ?? []) {
          const ip = priv.Association?.PublicIp;
          if (!ip) continue;
          const isEip = !!priv.Association?.AllocationId || (priv.Association?.IpOwnerId ?? "amazon") !== "amazon";
          const owner = eni.Attachment?.InstanceId ?? eni.InterfaceType ?? eni.Description ?? "network interface";
          findings.push({
            id: findingId("public-ipv4", region, ip),
            checkType: "public-ipv4",
            resourceId: ip,
            resourceName: nameTag(eni.TagSet) || owner,
            region,
            details: `${isEip ? "Elastic IP" : "Auto-assigned public IP"} ${ip} on ${eni.NetworkInterfaceId} (${owner}). Since Feb 2024 AWS bills every public IPv4 address ${usd(PUBLIC_IPV4_MONTHLY)}/month, even when in use.`,
            estimatedMonthlyCostUSD: PUBLIC_IPV4_MONTHLY,
            severity: "low",
            recommendation:
              "Keep only addresses that must be reachable from the internet. Put web servers behind one load balancer, give private servers outbound access through a NAT gateway or VPC endpoints, use SSM Session Manager instead of public SSH, or move to IPv6.",
            awsCliFixCommand: isEip && priv.Association?.AssociationId
              ? `aws ec2 disassociate-address --association-id ${priv.Association.AssociationId} --region ${region}`
              : `aws ec2 modify-network-interface-attribute --network-interface-id ${eni.NetworkInterfaceId} --no-associate-public-ip-address --region ${region}`,
          });
        }
      }
    }
    return findings;
  },
};
