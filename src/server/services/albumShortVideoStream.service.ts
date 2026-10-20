/*
 * Purpose: plays the album's uploaded "Video scurt" through Bunny Stream (adaptive quality: the
 * player picks 360p…1080p from the viewer's speed). The original stays in Storage for download;
 * Stream pulls its own copy from the Storage CDN URL, so the admin uploads only once.
 *
 * Firestore `albumShortVideoStreams/{slug}` remembers which Storage file was sent to Stream.
 * The fetch API does not return the new video's id, so it is found by its unique title.
 */
import { firestore } from "../firestore";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { SHORT_VIDEO_FOLDER } from "../../shared/albumShortVideo";

const COL = "albumShortVideoStreams";
const API = "https://video.bunnycdn.com/library";
const RECHECK_MS = 30_000;
// Stream lists a fetched video within minutes; none after this → the fetch was lost, re-upload.
const FIND_TIMEOUT_MS = 2 * 60 * 60_000;
// Bunny statuses: 4 Finished, 5 Error, 6 UploadFailed.
const STREAM_FINISHED = 4;
const STREAM_FAILED = new Set([5, 6]);

export type ShortVideoStreamStatus = "processing" | "ready" | "failed";
export type ShortVideoStream = { status: ShortVideoStreamStatus; embedUrl: string | null; hlsUrl?: string | null };

type StreamRecord = {
  fileName: string;
  title: string;
  guid: string | null;
  status: ShortVideoStreamStatus;
  requestedAt: number;
};

/** Album videos may use their own library; otherwise the one the landing pages already use. */
function streamConfig(): { libraryId: string; apiKey: string } | null {
  const libraryId = process.env.BUNNY_STREAM_ALBUM_LIBRARY_ID || process.env.BUNNY_STREAM_LIBRARY_ID || "";
  const apiKey = process.env.BUNNY_STREAM_ALBUM_API_KEY || process.env.BUNNY_STREAM_API_KEY || "";
  return libraryId && apiKey ? { libraryId, apiKey } : null;
}

const embedUrl = (libraryId: string, guid: string) =>
  `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=false&preload=false&responsive=true`;

// The library's pull zone (Stream → API → "CDN Hostname", e.g. vz-ab12cd34-5ef.b-cdn.net). With it
// /media plays the HLS playlist in our own player; without it, Bunny's iframe player.
const hlsUrl = (guid: string): string | null => {
  const host = (process.env.BUNNY_STREAM_ALBUM_CDN_HOSTNAME || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return host ? `https://${host}/${guid}/playlist.m3u8` : null;
};

const ready = (libraryId: string, guid: string): ShortVideoStream => ({ status: "ready", embedUrl: embedUrl(libraryId, guid), hlsUrl: hlsUrl(guid) });

const lastChecked = new Map<string, number>();
const ref = (slug: string) => firestore().collection(COL).doc(slug);

async function streamApi(path: string, init: RequestInit = {}): Promise<Response> {
  const config = streamConfig();
  if (!config) throw new Error("Bunny Stream not configured");
  return fetch(`${API}/${config.libraryId}${path}`, {
    ...init,
    headers: { AccessKey: config.apiKey, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
}

async function deleteStreamVideo(guid: string | null): Promise<void> {
  if (!guid) return;
  const response = await streamApi(`/videos/${guid}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`Bunny Stream delete ${response.status}`);
}

/**
 * Marks `fileName` as the album's Stream file. Returns false when it already is (another request
 * claimed it first), so each Storage file is sent to Stream exactly once.
 */
async function claimShortVideoStream(slug: string, fileName: string): Promise<{ previousGuid: string | null } | null> {
  return firestore().runTransaction(async (transaction) => {
    const record = (await transaction.get(ref(slug))).data() as StreamRecord | undefined;
    if (record?.fileName === fileName) return null;
    const claim: StreamRecord = { fileName, title: "", guid: null, status: "processing", requestedAt: Date.now() };
    transaction.set(ref(slug), claim);
    return { previousGuid: record?.guid ?? null };
  });
}

/** Sends the Storage file to Stream and replaces the previous Stream copy. Never throws. */
export async function startShortVideoStream(slug: string, fileName: string): Promise<void> {
  if (!streamConfig()) return;
  try {
    const claim = await claimShortVideoStream(slug, fileName);
    if (!claim) return;
    await deleteStreamVideo(claim.previousGuid).catch((error) => console.warn(`[stream] ${slug}: old video not deleted:`, error));

    const title = `album ${slug} · ${fileName} · ${Date.now()}`;
    await ref(slug).update({ title });
    const response = await streamApi("/videos/fetch", {
      method: "POST",
      body: JSON.stringify({ url: signBunnyUrl(`/${slug}/${SHORT_VIDEO_FOLDER}/${fileName}`), title }),
    });
    if (!response.ok) {
      console.error(`[stream] ${slug}: fetch ${response.status} ${await response.text().catch(() => "")}`);
      await ref(slug).update({ status: "failed" });
    }
  } catch (error) {
    console.error(`[stream] ${slug}: start failed:`, error);
    // Otherwise the album would stay "processing" forever; the page keeps the original player.
    await ref(slug).update({ status: "failed" }).catch(() => {});
  }
}

export async function removeShortVideoStream(slug: string): Promise<void> {
  if (!streamConfig()) return;
  const record = (await ref(slug).get()).data() as StreamRecord | undefined;
  if (record?.guid) await deleteStreamVideo(record.guid);
  await ref(slug).delete();
}

/**
 * Stream state for the album's current Storage file. A file never sent to Stream (uploaded before
 * this existed, or straight into Bunny) is sent now, once. null = Stream off → the page uses <video>.
 */
export async function getShortVideoStream(slug: string, fileName: string): Promise<ShortVideoStream | null> {
  const config = streamConfig();
  if (!config) return null;
  const snap = await ref(slug).get();
  const record = snap.data() as StreamRecord | undefined;

  if (!record || record.fileName !== fileName) {
    void startShortVideoStream(slug, fileName);
    return { status: "processing", embedUrl: null };
  }
  if (record.status === "ready" && record.guid) return ready(config.libraryId, record.guid);
  if (record.status === "failed") return { status: "failed", embedUrl: null };

  // Processing: ask Bunny at most every 30 s per album, page views must not hammer the API.
  if (Date.now() - (lastChecked.get(slug) ?? 0) < RECHECK_MS || !record.title) return { status: "processing", embedUrl: null };
  lastChecked.set(slug, Date.now());
  try {
    let guid = record.guid;
    if (!guid) {
      const response = await streamApi(`/videos?search=${encodeURIComponent(record.title)}&itemsPerPage=10`);
      if (!response.ok) return { status: "processing", embedUrl: null };
      const data = await response.json() as { items?: { guid: string; title: string }[] };
      guid = data.items?.find((item) => item.title === record.title)?.guid ?? null;
      if (!guid && Date.now() - record.requestedAt > FIND_TIMEOUT_MS) {
        await ref(slug).update({ status: "failed" });
        return { status: "failed", embedUrl: null };
      }
      if (!guid) return { status: "processing", embedUrl: null };
      await ref(slug).update({ guid });
    }
    const response = await streamApi(`/videos/${guid}`);
    if (!response.ok) return { status: "processing", embedUrl: null };
    const video = await response.json() as { status: number };
    if (video.status === STREAM_FINISHED) {
      await ref(slug).update({ status: "ready" });
      return ready(config.libraryId, guid);
    }
    if (STREAM_FAILED.has(video.status)) {
      await ref(slug).update({ status: "failed" });
      return { status: "failed", embedUrl: null };
    }
  } catch (error) {
    console.warn(`[stream] ${slug}: status check failed:`, error);
  }
  return { status: "processing", embedUrl: null };
}
