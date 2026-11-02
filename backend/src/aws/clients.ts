import { EC2Client } from "@aws-sdk/client-ec2";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { S3Client } from "@aws-sdk/client-s3";
import { STSClient } from "@aws-sdk/client-sts";

/**
 * Credentials come from the default AWS credential chain (env vars, AWS_PROFILE,
 * ~/.aws/credentials, SSO, instance/Lambda role). Keys are never hardcoded.
 * "adaptive" retry mode backs off automatically on throttling.
 */
const common = { maxAttempts: 5, retryMode: "adaptive" } as const;

export interface RegionClients {
  region: string;
  ec2: EC2Client;
  cloudwatch: CloudWatchClient;
  s3: S3Client;
}

const cache = new Map<string, RegionClients>();

export function clientsFor(region: string): RegionClients {
  let c = cache.get(region);
  if (!c) {
    c = {
      region,
      ec2: new EC2Client({ region, ...common }),
      cloudwatch: new CloudWatchClient({ region, ...common }),
      s3: new S3Client({ region, ...common }),
    };
    cache.set(region, c);
  }
  return c;
}

export function stsClient(region: string): STSClient {
  return new STSClient({ region, ...common });
}
