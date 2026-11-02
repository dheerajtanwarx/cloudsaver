/**
 * Approximate on-demand prices for ap-south-1 (Asia Pacific - Mumbai), Linux, USD.
 * Last checked: 2026-11-02. Static on purpose: no Pricing API / Cost Explorer calls
 * (Cost Explorer charges $0.01 per request). Verify against https://aws.amazon.com/pricing
 * before quoting exact numbers to a customer.
 */

export const HOURS_PER_MONTH = 730;

/** EBS volume storage, USD per GB-month. */
export const EBS_PRICE_PER_GB: Record<string, number> = {
  gp2: 0.114,
  gp3: 0.0912,
  io1: 0.131,
  io2: 0.131,
  st1: 0.051,
  sc1: 0.0174,
  standard: 0.08,
};

/** EBS snapshot storage (standard tier), USD per GB-month. */
export const SNAPSHOT_PRICE_PER_GB = 0.05;

/** gp3 provisioned IOPS above the free 3,000 baseline, USD per IOPS-month. */
export const GP3_IOPS_PRICE = 0.0055;

/** Public IPv4 address (in-use or idle, incl. Elastic IPs), USD per hour. */
export const PUBLIC_IPV4_PRICE_PER_HOUR = 0.005;

/** EC2 on-demand Linux, USD per hour. */
export const EC2_PRICE_PER_HOUR: Record<string, number> = {
  "t2.nano": 0.0062, "t2.micro": 0.0124, "t2.small": 0.0248, "t2.medium": 0.0496,
  "t2.large": 0.0992, "t2.xlarge": 0.1984, "t2.2xlarge": 0.3968,
  "t3.nano": 0.0056, "t3.micro": 0.0112, "t3.small": 0.0224, "t3.medium": 0.0448,
  "t3.large": 0.0896, "t3.xlarge": 0.1792, "t3.2xlarge": 0.3584,
  "t3a.nano": 0.0051, "t3a.micro": 0.0101, "t3a.small": 0.0202, "t3a.medium": 0.0403,
  "t3a.large": 0.0806, "t3a.xlarge": 0.1613, "t3a.2xlarge": 0.3226,
  "t4g.nano": 0.0045, "t4g.micro": 0.009, "t4g.small": 0.018, "t4g.medium": 0.0359,
  "t4g.large": 0.0717, "t4g.xlarge": 0.1434, "t4g.2xlarge": 0.2867,
  "m4.large": 0.105, "m4.xlarge": 0.21, "m4.2xlarge": 0.42, "m4.4xlarge": 0.84,
  "m5.large": 0.101, "m5.xlarge": 0.202, "m5.2xlarge": 0.404, "m5.4xlarge": 0.808,
  "m6i.large": 0.101, "m6i.xlarge": 0.202, "m6i.2xlarge": 0.404,
  "m6g.large": 0.081, "m6g.xlarge": 0.162, "m6g.2xlarge": 0.324,
  "c4.large": 0.1, "c4.xlarge": 0.2, "c4.2xlarge": 0.4, "c4.4xlarge": 0.8,
  "c5.large": 0.085, "c5.xlarge": 0.17, "c5.2xlarge": 0.34, "c5.4xlarge": 0.68,
  "c6g.large": 0.068, "c6g.xlarge": 0.136, "c6g.2xlarge": 0.272,
  "r4.large": 0.137, "r4.xlarge": 0.274, "r4.2xlarge": 0.548,
  "r5.large": 0.128, "r5.xlarge": 0.256, "r5.2xlarge": 0.512,
  "r6g.large": 0.1032, "r6g.xlarge": 0.2064, "r6g.2xlarge": 0.4128,
};

export const SIZE_ORDER = [
  "nano", "micro", "small", "medium", "large", "xlarge", "2xlarge", "4xlarge", "8xlarge",
] as const;

/** Previous-generation family -> current-generation x86 equivalent (Graviton alternative noted separately). */
export const NEXT_GEN_FAMILY: Record<string, { x86: string; graviton?: string }> = {
  t1: { x86: "t3", graviton: "t4g" },
  t2: { x86: "t3", graviton: "t4g" },
  m1: { x86: "m5", graviton: "m6g" },
  m3: { x86: "m5", graviton: "m6g" },
  m4: { x86: "m5", graviton: "m6g" },
  c1: { x86: "c5", graviton: "c6g" },
  c3: { x86: "c5", graviton: "c6g" },
  c4: { x86: "c5", graviton: "c6g" },
  r3: { x86: "r5", graviton: "r6g" },
  r4: { x86: "r5", graviton: "r6g" },
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ebsMonthly(volumeType: string | undefined, sizeGb: number): number | undefined {
  const price = EBS_PRICE_PER_GB[volumeType ?? ""];
  return price === undefined ? undefined : round2(price * sizeGb);
}

export function ec2Monthly(instanceType: string): number | undefined {
  const hourly = EC2_PRICE_PER_HOUR[instanceType];
  return hourly === undefined ? undefined : round2(hourly * HOURS_PER_MONTH);
}

export function splitInstanceType(instanceType: string): { family: string; size: string } {
  const [family = "", size = ""] = instanceType.split(".");
  return { family, size };
}

/** One size smaller in the same family, if we have a price for it (t3.medium -> t3.small). */
export function oneSizeDown(instanceType: string): string | undefined {
  const { family, size } = splitInstanceType(instanceType);
  const idx = SIZE_ORDER.indexOf(size as (typeof SIZE_ORDER)[number]);
  if (idx <= 0) return undefined;
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = `${family}.${SIZE_ORDER[i]}`;
    if (EC2_PRICE_PER_HOUR[candidate] !== undefined) return candidate;
  }
  return undefined;
}

export const PUBLIC_IPV4_MONTHLY = round2(PUBLIC_IPV4_PRICE_PER_HOUR * HOURS_PER_MONTH);
