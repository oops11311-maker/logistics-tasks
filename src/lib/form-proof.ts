import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requestStage } from "./access";
import { sql } from "./db";
import { asJson } from "./format";
import { HttpError } from "./http";

const KEY_NAME = "form_mac";
const SETUP_TTL_SECONDS = 60 * 10;

export type FormPurpose = "setup" | "login";

let keyPromise: Promise<string> | undefined;

function readKey(value: unknown): string | undefined {
  const parsed = asJson<{ v?: unknown }>(value, {});
  if (typeof parsed.v !== "string" || parsed.v.length < 32) return undefined;
  return parsed.v;
}

async function loadKey(): Promise<string> {
  const stage = await requestStage(new Request("https://app.local/"));
  const existing = await sql<{ value: unknown }>(
    `select value from settings where stage = $1 and key = $2`,
    [stage, KEY_NAME],
  );
  const found = readKey(existing[0]?.value);
  if (found) return found;
  const created = randomBytes(32).toString("base64url");
  await sql(
    `insert into settings (stage, key, value) values ($1, $2, $3::jsonb)
     on conflict (stage, key) do nothing`,
    [stage, KEY_NAME, JSON.stringify({ v: created })],
  );
  const stored = await sql<{ value: unknown }>(
    `select value from settings where stage = $1 and key = $2`,
    [stage, KEY_NAME],
  );
  const key = readKey(stored[0]?.value);
  if (!key) throw new HttpError(500, "server", "요청을 처리하지 못했습니다.");
  return key;
}

function macKey(): Promise<string> {
  keyPromise ??= loadKey().catch((error: unknown) => {
    keyPromise = undefined;
    throw error;
  });
  return keyPromise;
}

function mac(key: string, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export async function issueFormProof(purpose: FormPurpose, expiresAtSeconds?: number): Promise<string> {
  const key = await macKey();
  const exp = expiresAtSeconds ?? Math.floor(Date.now() / 1000) + SETUP_TTL_SECONDS;
  const payload = `${purpose}.${exp}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${mac(key, payload)}`;
}

export async function assertFormProof(token: string, purpose: FormPurpose): Promise<void> {
  const parts = token.split(".");
  if (parts.length !== 4) throw new HttpError(403, "csrf", "요청을 확인하지 못했습니다. 다시 열어 주세요.");
  const [givenPurpose, expRaw, nonce, givenMac] = parts;
  const exp = Number(expRaw);
  const payload = `${givenPurpose}.${expRaw}.${nonce}`;
  const key = await macKey();
  const expected = mac(key, payload);
  const left = Buffer.from(givenMac);
  const right = Buffer.from(expected);
  const macOk = left.length === right.length && timingSafeEqual(left, right);
  const fresh = Number.isFinite(exp) && exp >= Math.floor(Date.now() / 1000);
  if (!macOk || givenPurpose !== purpose || !fresh) {
    throw new HttpError(403, "csrf", "요청을 확인하지 못했습니다. 다시 열어 주세요.");
  }
}
