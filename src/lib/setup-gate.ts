import { getIdentity } from "../../cursor/identity.js";

export const SETUP_OWNER_EMAIL = "oops11311@gmail.com";

const IDENTITY_REASONS = new Set([
  "missing_header",
  "malformed_token",
  "bad_signature",
  "unknown_key",
  "wrong_issuer",
  "wrong_audience",
  "invalid_claims",
  "expired",
  "issuer_unreachable",
  "app_id_unset",
  "dev_viewer_invalid",
  "simulated",
  "not_person",
  "email_mismatch",
]);

type GateIdentity = {
  verified: boolean;
  reason?: string;
  simulated?: boolean;
  kind?: string;
  email?: string;
  emailVerified?: boolean;
};

export type SetupOwner =
  | { ok: true; emailVerified: boolean }
  | { ok: false; reason: string };

function logClosed(reason: string): void {
  console.info("admin_setup_closed", IDENTITY_REASONS.has(reason) ? reason : "closed");
}

export async function setupOwner(request: Request): Promise<SetupOwner> {
  const identity = (await getIdentity(request)) as GateIdentity;
  if (!identity.verified) {
    const reason = typeof identity.reason === "string" ? identity.reason : "closed";
    logClosed(reason);
    return { ok: false, reason };
  }
  if (identity.simulated === true) {
    logClosed("simulated");
    return { ok: false, reason: "simulated" };
  }
  if (identity.kind !== "person") {
    logClosed("not_person");
    return { ok: false, reason: "not_person" };
  }
  const email = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
  if (email !== SETUP_OWNER_EMAIL) {
    logClosed("email_mismatch");
    return { ok: false, reason: "email_mismatch" };
  }
  return { ok: true, emailVerified: identity.emailVerified === true };
}
