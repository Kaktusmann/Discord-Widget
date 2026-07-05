import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "dwk_";
const PREFIX_DISPLAY_LENGTH = 12;

export interface GeneratedApiKey {
  raw: string;
  keyHash: string;
  keyPrefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const raw = KEY_PREFIX + randomBytes(24).toString("base64url");
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, PREFIX_DISPLAY_LENGTH),
  };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
