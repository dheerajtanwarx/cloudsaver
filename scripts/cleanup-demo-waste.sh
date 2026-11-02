#!/usr/bin/env bash
# Deletes ONLY the resources tagged Project=CloudSaverDemo (created by create-demo-waste.sh).
# Needs ec2:DeleteVolume / ec2:DeleteSnapshot, so use your admin profile.
#   AWS_PROFILE=default ./scripts/cleanup-demo-waste.sh [region]
set -euo pipefail

REGION="${1:-${AWS_REGION:-ap-south-1}}"
FILTER="Name=tag:Project,Values=CloudSaverDemo"

command -v aws >/dev/null || { echo "AWS CLI not found. Install it: brew install awscli" >&2; exit 1; }

SNAPSHOTS=$(aws ec2 describe-snapshots --region "$REGION" --owner-ids self --filters "$FILTER" \
  --query 'Snapshots[].SnapshotId' --output text)
VOLUMES=$(aws ec2 describe-volumes --region "$REGION" --filters "$FILTER" \
  --query 'Volumes[].VolumeId' --output text)

if [[ -z "$SNAPSHOTS" && -z "$VOLUMES" ]]; then
  echo "Nothing tagged Project=CloudSaverDemo in $REGION."
  exit 0
fi

echo "Will delete in $REGION:"
for s in $SNAPSHOTS; do echo "  snapshot $s"; done
for v in $VOLUMES;   do echo "  volume   $v"; done
read -r -p "Proceed? [y/N] " answer
[[ "$answer" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

for s in $SNAPSHOTS; do
  aws ec2 delete-snapshot --region "$REGION" --snapshot-id "$s" && echo "Deleted snapshot $s"
done
for v in $VOLUMES; do
  aws ec2 delete-volume --region "$REGION" --volume-id "$v" && echo "Deleted volume $v"
done
echo "Cleanup complete."
