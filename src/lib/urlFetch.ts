import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function isPrivateOrLoopbackIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 0) return true;
    return false;
  }
  // IPv6: loopback (::1), unique local (fc00::/7), link-local (fe80::/10)
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  return false;
}

export class UnsafeUrlError extends Error {}

/** Fetches JSON from a user-supplied URL with basic SSRF protections: http(s) only, blocks loopback/private/link-local targets, enforces a timeout and a response size cap. */
export async function fetchJsonSafely(rawUrl: string): Promise<unknown> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  const { address } = await lookup(url.hostname);
  if (isPrivateOrLoopbackIp(address)) {
    throw new UnsafeUrlError(`Refusing to fetch a private/loopback address: ${url.hostname}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      throw new Error(`Response too large (${contentLength} bytes)`);
    }

    const reader = res.body?.getReader();
    if (!reader) return await res.json();

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Response exceeded the size cap");
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}
