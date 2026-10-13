/** Reconnects the progress stream; a lost connection does not mean the job failed. */
export function watchAlbumProcessing(
  slug: string,
  accessToken: string | (() => Promise<string>),
  onEvent: (event: Record<string, unknown>) => void,
  onConnectionChange: (reconnecting: boolean) => void,
): () => void {
  let stopped = false;
  let controller: AbortController | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    controller = new AbortController();
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller?.abort(), 45_000);
    };
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      resetIdle();
      const token = typeof accessToken === "function" ? await accessToken() : accessToken;
      if (stopped) return;
      const response = await fetch(`/api/admin/album-health/${encodeURIComponent(slug)}/live`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("Progress unavailable");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done || stopped) break;
        resetIdle();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
          onConnectionChange(false);
          onEvent(event);
          if (event.type === "done" || (event.type === "init" && event.status === "done")) {
            stopped = true;
            break;
          }
        }
      }
    } catch {
      // Keep the last confirmed progress while the server works or resumes its queue.
    } finally {
      clearTimeout(idleTimer);
      controller.abort();
      await reader?.cancel().catch(() => {});
      if (!stopped) {
        onConnectionChange(true);
        retryTimer = setTimeout(() => void connect(), 3000);
      }
    }
  };
  void connect();
  return () => { stopped = true; clearTimeout(retryTimer); clearTimeout(idleTimer); controller?.abort(); };
}
