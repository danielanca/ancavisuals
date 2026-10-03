// Byte size of public files (CDN photos), from a HEAD request. Cached per URL for a
// day — the files behind these URLs never change in place. Never throws: an
// unknown size is `undefined`.

const TTL_MS = 24 * 60 * 60_000;
const HEAD_TIMEOUT_MS = 4000;
const CONCURRENCY = 8;

const cache = new Map<string, { bytes: number | undefined; at: number }>();
const inFlight = new Map<string, Promise<void>>();

async function headSize(url: string): Promise<number | undefined> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) });
    const length = Number(res.headers.get("content-length"));
    return res.ok && Number.isFinite(length) && length > 0 ? length : undefined;
  } catch {
    return undefined;
  }
}

function fresh(url: string) {
  const hit = cache.get(url);
  return hit && Date.now() - hit.at < TTL_MS ? hit : undefined;
}

async function fill(urls: string[]): Promise<void> {
  const todo = [...new Set(urls)].filter((url) => !fresh(url));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const url = todo[next++];
      let job = inFlight.get(url);
      if (!job) {
        job = headSize(url).then((bytes) => { cache.set(url, { bytes, at: Date.now() }); }).finally(() => inFlight.delete(url));
        inFlight.set(url, job);
      }
      await job;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
}

/**
 * Sizes for these URLs. Waits at most `waitMs` for the ones not cached yet (the rest
 * keep loading in the background for the next request) so a cold cache never holds
 * the page back for long.
 */
export async function remoteFileSizes(urls: string[], waitMs = 1500): Promise<Map<string, number | undefined>> {
  const job = fill(urls);
  await Promise.race([job, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  return new Map(urls.map((url) => [url, fresh(url)?.bytes]));
}
