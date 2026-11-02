export interface ClassifiedError {
  code: "NO_CREDENTIALS" | "ACCESS_DENIED" | "THROTTLED" | "NETWORK" | "INVALID_REGION" | "EXPIRED_CREDENTIALS" | "UNKNOWN";
  message: string;
  /** Raw AWS error name, useful for debugging. */
  awsError?: string;
}

function errName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err && typeof err.name === "string") return err.name;
  return "";
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function classifyAwsError(err: unknown, action?: string): ClassifiedError {
  const name = errName(err);
  const msg = errMessage(err);
  const what = action ? ` (${action})` : "";

  if (name === "CredentialsProviderError" || /Could not load credentials|credential/i.test(msg) && /load|find|resolve/i.test(msg)) {
    return {
      code: "NO_CREDENTIALS",
      awsError: name,
      message:
        "No AWS credentials found. Run `aws configure` (or set AWS_PROFILE) with the CloudSaver read-only IAM user, then try again. You can also start with DEMO_MODE=true.",
    };
  }
  if (["ExpiredToken", "ExpiredTokenException", "RequestExpired"].includes(name)) {
    return { code: "EXPIRED_CREDENTIALS", awsError: name, message: "Your AWS session token has expired. Refresh your credentials (e.g. `aws sso login`) and rescan." };
  }
  if (["InvalidClientTokenId", "SignatureDoesNotMatch", "UnrecognizedClientException", "AuthFailure"].includes(name)) {
    return { code: "NO_CREDENTIALS", awsError: name, message: "AWS rejected the credentials (invalid access key or secret). Re-run `aws configure` with a valid key." };
  }
  if (
    ["AccessDenied", "AccessDeniedException", "UnauthorizedOperation", "Forbidden", "AllAccessDisabled"].includes(name) ||
    /not authorized|access denied/i.test(msg)
  ) {
    return {
      code: "ACCESS_DENIED",
      awsError: name,
      message: `Access denied${what}. Attach iam/cloudsaver-readonly-policy.json to your IAM user/role. AWS said: ${msg}`,
    };
  }
  if (["Throttling", "ThrottlingException", "RequestLimitExceeded", "TooManyRequestsException", "SlowDown"].includes(name)) {
    return { code: "THROTTLED", awsError: name, message: `AWS throttled the request${what} even after retries. Wait a minute and rescan.` };
  }
  if (["OptInRequired", "InvalidRegion", "UnrecognizedRegion"].includes(name)) {
    return { code: "INVALID_REGION", awsError: name, message: `Region not enabled for this account${what}.` };
  }
  if (["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "TimeoutError", "NetworkingError"].includes(name) || /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|getaddrinfo/i.test(msg)) {
    return { code: "NETWORK", awsError: name, message: "Could not reach AWS (network error). Check your internet connection, or use DEMO_MODE=true offline." };
  }
  return { code: "UNKNOWN", awsError: name || undefined, message: msg || "Unknown AWS error" };
}
