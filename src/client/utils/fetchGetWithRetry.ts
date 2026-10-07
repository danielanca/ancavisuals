/** Retry read-only requests after temporary network or server failures. */
export async function fetchGetWithRetry(url: string, init: Omit<RequestInit, "method" | "body"> = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    init.signal?.throwIfAborted();
    try {
      const response = await fetch(url, { ...init, method: "GET" });
      if (attempt >= 2 || ![408, 429, 500, 502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      if (init.signal?.aborted || !(error instanceof TypeError) || attempt >= 2) throw error;
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer);
        reject(init.signal?.reason);
      };
      const timer = setTimeout(() => {
        init.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, (attempt + 1) * 1000);
      init.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
