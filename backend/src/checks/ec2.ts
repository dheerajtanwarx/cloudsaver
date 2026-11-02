import { type Instance, DescribeVolumesCommand, paginateDescribeInstances, type Volume } from "@aws-sdk/client-ec2";
import type { RegionClients } from "../aws/clients.js";

export async function listInstances(clients: RegionClients, states: string[]): Promise<Instance[]> {
  const out: Instance[] = [];
  const pages = paginateDescribeInstances(
    { client: clients.ec2 },
    { Filters: [{ Name: "instance-state-name", Values: states }] },
  );
  for await (const page of pages) {
    for (const r of page.Reservations ?? []) out.push(...(r.Instances ?? []));
  }
  return out;
}

export async function describeVolumesById(clients: RegionClients, ids: string[]): Promise<Map<string, Volume>> {
  const map = new Map<string, Volume>();
  for (let i = 0; i < ids.length; i += 200) {
    const res = await clients.ec2.send(new DescribeVolumesCommand({ VolumeIds: ids.slice(i, i + 200) }));
    for (const v of res.Volumes ?? []) if (v.VolumeId) map.set(v.VolumeId, v);
  }
  return map;
}
