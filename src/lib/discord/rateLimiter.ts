import { DiscordApiError } from "@/lib/discord/client";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface QueuedJob {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

class SerialQueue {
  private queue: QueuedJob[] = [];
  private running = false;

  enqueue<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run: job, resolve: resolve as (value: unknown) => void, reject });
      void this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let job: QueuedJob | undefined;
      while ((job = this.queue.shift())) {
        try {
          const result = await this.runWithRetry(job.run);
          job.resolve(result);
        } catch (err) {
          job.reject(err);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async runWithRetry(run: () => Promise<unknown>): Promise<unknown> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        return await run();
      } catch (err) {
        const isRateLimit = err instanceof DiscordApiError && err.status === 429;
        if (!isRateLimit || attempt >= MAX_ATTEMPTS) {
          throw err;
        }
        const backoff = err.retryAfterMs ?? BASE_BACKOFF_MS * 2 ** (attempt - 1);
        const jitter = Math.random() * 100;
        await sleep(backoff + jitter);
      }
    }
  }
}

export const discordQueue = new SerialQueue();
