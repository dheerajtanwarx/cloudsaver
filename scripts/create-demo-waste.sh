#!/usr/bin/env bash
# Creates CHEAP, safe test waste so CloudSaver has something real to find:
#   - one unattached 1 GB gp2 EBS volume   (~$0.114/month in ap-south-1)
#   - one snapshot of that volume           (~$0.05/month, usually less)
# Everything is tagged Project=CloudSaverDemo. Remove it with scripts/cleanup-demo-waste.sh.
# Does NOT create instances or Elastic IPs.
#
# NOTE: this script needs WRITE permissions (ec2:CreateVolume, ec2:CreateSnapshot, ec2:CreateTags),
# so run it with your admin profile, not the CloudSaver read-only user:
#   AWS_PROFILE=default ./scripts/create-demo-waste.sh [region]
set -euo pipefail

REGION="${1:-${AWS_REGION:-ap-south-1}}"
TAG_KEY="Project"
TAG_VALUE="CloudSaverDemo"

command -v aws >/dev/null || { echo "AWS CLI not found. Install it: brew install awscli" >&2; exit 1; }

existing=$(aws ec2 describe-volumes --region "$REGION" \
  --filters "Name=tag:$TAG_KEY,Values=$TAG_VALUE" --query 'Volumes[].VolumeId' --output text)
if [[ -n "$existing" ]]; then
  echo "Demo volume already exists in $REGION: $existing (run cleanup-demo-waste.sh first to recreate)."
  exit 0
fi

AZ=$(aws ec2 describe-availability-zones --region "$REGION" \
  --filters Name=state,Values=available --query 'AvailabilityZones[0].ZoneName' --output text)

echo "Creating 1 GB gp2 volume in $AZ ..."
VOLUME_ID=$(aws ec2 create-volume --region "$REGION" --availability-zone "$AZ" \
  --size 1 --volume-type gp2 \
  --tag-specifications "ResourceType=volume,Tags=[{Key=$TAG_KEY,Value=$TAG_VALUE},{Key=Name,Value=cloudsaver-demo-volume}]" \
  --query VolumeId --output text)
aws ec2 wait volume-available --region "$REGION" --volume-ids "$VOLUME_ID"
echo "  volume:   $VOLUME_ID"

echo "Creating snapshot ..."
SNAPSHOT_ID=$(aws ec2 create-snapshot --region "$REGION" --volume-id "$VOLUME_ID" \
  --description "CloudSaver demo snapshot" \
  --tag-specifications "ResourceType=snapshot,Tags=[{Key=$TAG_KEY,Value=$TAG_VALUE},{Key=Name,Value=cloudsaver-demo-snapshot}]" \
  --query SnapshotId --output text)
echo "  snapshot: $SNAPSHOT_ID (completes in the background)"

cat <<MSG

Done. Run a scan in CloudSaver: expect an "Unattached EBS volume" finding for $VOLUME_ID.
The snapshot is only flagged once it is older than SNAPSHOT_AGE_DAYS (default 30);
set SNAPSHOT_AGE_DAYS=0 in .env to see it immediately.
Clean up afterwards: ./scripts/cleanup-demo-waste.sh $REGION
MSG
