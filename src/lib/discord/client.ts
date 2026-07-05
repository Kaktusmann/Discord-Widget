const USER_AGENT = "DiscordWidgetManager/1.0 (+self-hosted)";

export class DiscordApiError extends Error {
  constructor(
    public status: number,
    public retryAfterMs: number | undefined,
    public body: unknown,
  ) {
    super(`Discord API error ${status}: ${JSON.stringify(body)}`);
    this.name = "DiscordApiError";
  }
}

export interface DiscordRequestOptions {
  method: string;
  path: string;
  version?: "v9" | "v10";
  /** Fully formed Authorization header value, e.g. "Bot xxx" or "Bearer xxx" */
  token: string;
  body?: unknown;
}

export async function discordRequest<T>(opts: DiscordRequestOptions): Promise<T> {
  const res = await fetch(`https://discord.com/api/${opts.version ?? "v10"}${opts.path}`, {
    method: opts.method,
    headers: {
      Authorization: opts.token,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    const body = await res.json().catch(() => null);
    throw new DiscordApiError(429, retryAfterMs, body);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new DiscordApiError(res.status, undefined, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
