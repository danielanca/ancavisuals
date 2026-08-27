import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import useAuth from '../../features/admin/auth/useAuth';
import { getHeadlineText, getHostsPairLabel, normalizeQrEventType, type QrEventType } from '../../../shared/qrMoments/hostRoles';
import { MAX_UPLOAD_FILE_SIZE_BYTES, MAX_UPLOAD_FILE_SIZE_MB } from '../../../shared/qrMoments/uploadLimits';
import PortfolioGallery from '../Portfolio/PortfolioGallery';

type Step = 'loading' | 'closed' | 'not-found' | 'form' | 'upload' | 'success';
type MediaTab = 'photo' | 'video' | 'audio';

interface EventInfo {
  bride: string | null;
  groom: string | null;
  isOpen: boolean;
  deadline: string;
  eventType: QrEventType;
}

interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string;
}

type UploadItemStatus = 'uploading' | 'done' | 'error';
interface UploadProgressEntry {
  status: UploadItemStatus;
  progress: number;
  error?: string;
}

type LegacyAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const DISPLAYABLE_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DISPLAYABLE_VIDEO = ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/hevc'];
const DISPLAYABLE_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
const WHATSAPP_SUPPORT = 'https://wa.me/40745469907';

const WhatsAppHelp = ({ message }: { message?: string }) => (
  <a
    href={`${WHATSAPP_SUPPORT}?text=${encodeURIComponent(message ?? 'Bună! Am o problemă cu QR Moments.')}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.561 4.14 1.535 5.874L.057 23.943l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.369l-.36-.214-3.7.97.988-3.608-.234-.372A9.818 9.818 0 0112 2.182c5.424 0 9.818 4.394 9.818 9.818 0 5.425-4.394 9.818-9.818 9.818z"/></svg>
    Trimite pe WhatsApp
  </a>
);

const SUBHEAD_TEXT = 'Creăm experiențe complete pentru evenimente: foto, video, fotocabină, video booth 360 și QR Moments.';
const REFERRAL_TEXT = 'Recomandă-ne mai departe și primești o ședință foto cadou.';

function mapQrApiError(error: string): string {
  if (error === 'Acces interzis.') {
    return 'Link invalid. Verifică codul QR sau cere un link nou.';
  }
  if (error === 'Perioada de upload s-a închis.') {
    return 'Perioada de upload s-a închis pentru acest eveniment.';
  }
  if (error === 'Evenimentul nu există.') {
    return 'Evenimentul nu a fost găsit. Verifică linkul primit.';
  }
  return error;
}

export default function QRMomentsPage() {
  const { eventSlug: routeEventSlug } = useParams<{ eventSlug: string }>();
  const [searchParams] = useSearchParams();
  const eventSlug = routeEventSlug ?? '';
  const pass = searchParams.get('pass') ?? '';
  const { auth } = useAuth();

  const [step, setStep] = useState<Step>('loading');
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [guestId, setGuestId] = useState<string | null>(null);
  const [mediaTab, setMediaTab] = useState<MediaTab>('photo');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgressEntry>>({});

  const [audioPermission, setAudioPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState(60);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const consoleBufferRef = useRef<string[]>([]);
  const debugSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (step !== 'success') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const serializeDebugValue = (value: unknown): string => {
    if (value instanceof Error) return `${value.message}\n${value.stack ?? ''}`;
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const pushConsoleEntry = (level: 'error' | 'warn', args: unknown[]) => {
    const entry = `[${new Date().toISOString()}] ${level.toUpperCase()} ${args.map(serializeDebugValue).join(' ')}`;
    consoleBufferRef.current = [...consoleBufferRef.current.slice(-14), entry];
  };

  const reportQrDebug = (message: string, details: Record<string, unknown>) => {
    const payload = {
      eventSlug,
      guestId,
      mediaTab,
      step,
      userAgent: navigator.userAgent,
      files: selectedFiles.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
      hasAudioBlob: audioBlob !== null,
      recentConsole: consoleBufferRef.current,
      ...details,
    };

    const signature = `${message}::${JSON.stringify(payload)}`;
    if (debugSentRef.current.has(signature)) return;
    debugSentRef.current.add(signature);

    fetch('/api/monitoring/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `[QR DEBUG] ${message}`,
        stack: JSON.stringify(payload, null, 2),
        page: window.location.pathname,
      }),
    }).catch(() => {});
  };

  const clearSelectedFiles = () => {
    setSelectedFiles((prev) => {
      prev.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      return [];
    });
    setUploadProgress((prev) => {
      const next: typeof prev = {};
      if (prev.audio) next.audio = prev.audio;
      return next;
    });
  };

  const stopWaveform = () => {
    if (waveformFrameRef.current !== null) {
      window.cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const startWaveform = async (stream: MediaStream) => {
    const canvas = waveformCanvasRef.current;
    const AudioContextCtor = window.AudioContext || (window as LegacyAudioWindow).webkitAudioContext;
    if (!canvas || !AudioContextCtor) return;

    stopWaveform();

    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;

    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => {});
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.fftSize);

    const draw = () => {
      const { clientWidth, clientHeight } = canvas;
      if (clientWidth === 0 || clientHeight === 0) {
        waveformFrameRef.current = window.requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(clientWidth * dpr);
      const height = Math.floor(clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      analyser.getByteTimeDomainData(data);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(38, 38, 38, 0.92)';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(2, dpr * 1.6);
      ctx.beginPath();

      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i += 1) {
        const y = (data[i] / 255) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      waveformFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();
  };

  useEffect(() => {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args: unknown[]) => {
      pushConsoleEntry('error', args);
      originalConsoleError(...args);
    };

    console.warn = (...args: unknown[]) => {
      pushConsoleEntry('warn', args);
      originalConsoleWarn(...args);
    };

    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);

  useEffect(() => {
    if (!eventSlug) { setStep('not-found'); return; }
    // Wait for auth to finish loading before making any routing decision.
    if (auth.loading) return;
    // Once auth is loaded: non-admin without pass -> not found.
    if (!auth.authorise && !pass) { setStep('not-found'); return; }

    const isAdminSession = auth.authorise && !!auth.accessToken;
    const url = isAdminSession
      ? `/api/qr-moments/${eventSlug}`
      : `/api/qr-moments/${eventSlug}?pass=${encodeURIComponent(pass)}`;
    const headers: Record<string, string> = {};
    if (isAdminSession) headers['Authorization'] = `Bearer ${auth.accessToken}`;

    fetch(url, { headers })
      .then((r) => r.json())
      .then((data: EventInfo & { error?: string }) => {
        if (data.error) { setStep('not-found'); return; }
        setEventInfo(data);
        // Admin session skips the guest form entirely (auto-registered below) —
        // stay on the loading spinner instead of flashing the form for a frame.
        if (isAdminSession) return;
        setStep(data.isOpen ? 'form' : 'closed');
      })
      .catch((error) => {
        reportQrDebug('Initial event lookup failed', { error: serializeDebugValue(error) });
        setStep('not-found');
      });
  }, [eventSlug, pass, auth.authorise, auth.accessToken, auth.loading]);

  useEffect(() => {
    if (mediaTab !== 'audio') return;
    if (!navigator.permissions?.query) { setAudioPermission('unknown'); return; }
    let permStatus: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        permStatus = status;
        setAudioPermission(status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'unknown');
        status.onchange = () => setAudioPermission(status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'unknown');
      })
      .catch(() => setAudioPermission('unknown'));
    return () => { if (permStatus) permStatus.onchange = null; };
  }, [mediaTab]);

  useEffect(() => {
    if (!isRecording) {
      stopWaveform();
      return;
    }

    const stream = recordingStreamRef.current;
    if (!stream || analyserRef.current || waveformFrameRef.current !== null) return;

    startWaveform(stream).catch(() => {});
  }, [isRecording]);

  // Admin flow: auto-register and jump straight to the upload step, skipping
  // the guest form (relies on eventInfo, not step, so it fires exactly once and
  // never re-triggers itself after a setStep('form') fallback on failure).
  useEffect(() => {
    if (!auth.authorise || !auth.accessToken || !eventInfo) return;
    fetch('/api/qr-moments/guest/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({
        eventSlug,
        name: 'Admin',
        email: auth.user?.email ?? 'admin@ancavisuals.ro',
        gdprConsent: true,
        emailConsent: false,
      }),
    })
      .then((r) => r.json())
      .then((result: { guestId?: string; error?: string }) => {
        if (result.guestId) {
          setGuestId(result.guestId);
          setStep('upload');
        } else {
          reportQrDebug('Admin auto-register failed', { apiError: result.error });
          setFormError(result.error ?? 'Auto-înregistrare admin eșuată.');
          setStep('form');
        }
      })
      .catch((error) => {
        reportQrDebug('Admin auto-register network failure', { error: serializeDebugValue(error) });
        setFormError('Eroare de rețea la auto-înregistrare admin.');
        setStep('form');
      });
  }, [eventInfo, auth.authorise, auth.accessToken]);

  const handleFormSubmit = async () => {
    setFormError(null);
    if (!name.trim() || !email.trim()) { setFormError('Completează numele și emailul.'); return; }
    if (!gdprConsent) { setFormError('Acordă consimțământul pentru prelucrarea datelor pentru a continua.'); return; }

    setFormLoading(true);
    try {
      const result = await fetch('/api/qr-moments/guest/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, name: name.trim(), email: email.trim(), gdprConsent, emailConsent, pass }),
      }).then((r) => r.json());

      if (result.error) {
        reportQrDebug('Guest register failed', { apiError: result.error, guestEmail: email.trim(), guestName: name.trim() });
        setFormError(mapQrApiError(result.error));
        return;
      }
      setGuestId(result.guestId);
      setStep('upload');
    } catch (error) {
      reportQrDebug('Guest register network failure', { error: serializeDebugValue(error), guestEmail: email.trim(), guestName: name.trim() });
      setFormError('Eroare de rețea. Încearcă din nou.');
    } finally {
      setFormLoading(false);
    }
  };

  const openFilePicker = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      // Copy the FileList before removing the temporary input. Some mobile
      // browsers clear or invalidate `input.files` as soon as the element is
      // detached from the DOM, which could silently reduce a multi-selection
      // to one (or zero) files.
      const candidateFiles = target.files
        ? Array.from(target.files).filter((file) => file.size > 0)
        : [];
      document.body.removeChild(input);
      if (candidateFiles.length === 0) return;

      const oversizedFiles = candidateFiles.filter((file) => file.size > MAX_UPLOAD_FILE_SIZE_BYTES);
      const validFiles = candidateFiles.filter((file) => file.size <= MAX_UPLOAD_FILE_SIZE_BYTES);

      if (oversizedFiles.length > 0) {
        setUploadError(
          `${oversizedFiles.length > 1 ? `${oversizedFiles.length} fișiere depășesc` : `Fișierul "${oversizedFiles[0].name}" depășește`} limita maximă de ${MAX_UPLOAD_FILE_SIZE_MB}MB și nu ${oversizedFiles.length > 1 ? 'au fost adăugate' : 'a fost adăugat'}. Încearcă să comprimi videoclipul sau trimite-l în părți mai mici.`,
        );
      } else if (validFiles.length > 0) {
        setUploadError(null);
      }

      if (validFiles.length === 0) return;
      const newFiles: SelectedFile[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    });
    input.click();
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    setUploadProgress((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setAudioPermission('granted');
    } catch {
      setAudioPermission('denied');
    }
  };

  const startRecording = async () => {
    try {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
      setAudioBlob(null);
      audioChunksRef.current = [];
      setAudioCurrentTime(0);
      setAudioDuration(0);
      setIsPlayingAudio(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stopWaveform();
        const recordedMime = recorder.mimeType || mimeType || 'audio/mp4';
        const blob = new Blob(audioChunksRef.current, { type: recordedMime });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioPreviewUrl(url);
        stopRecordingStream();
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSecondsLeft(60);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSecondsLeft((prev) => {
          if (prev <= 1) { stopRecording(); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setAudioPermission('denied');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    else {
      stopWaveform();
      stopRecordingStream();
    }
    setIsRecording(false);
  };

  const clearAudio = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    stopWaveform();
    stopRecordingStream();
    audioPlayerRef.current?.pause();
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setUploadProgress((prev) => {
      if (!('audio' in prev)) return prev;
      const next = { ...prev };
      delete next.audio;
      return next;
    });
  };

  const buildAudioFilename = (blob: Blob) => {
    const blobType = blob.type || '';
    const ext = blobType.includes('mp4') || blobType.includes('m4a') ? 'm4a'
      : blobType.includes('ogg') ? 'ogg'
      : blobType.includes('webm') ? 'webm'
      : 'm4a';
    return `voice-${Date.now()}.${ext}`;
  };

  // Fixed timeouts fail large phone videos on mobile data before they ever finish
  // uploading — scale the budget with file size instead, assuming a conservative
  // sustained mobile upload speed, capped so a genuinely stalled request doesn't
  // hang forever.
  const UPLOAD_MIN_TIMEOUT_MS = 90_000;
  const UPLOAD_MAX_TIMEOUT_MS = 15 * 60_000;
  const ASSUMED_MIN_UPLOAD_BYTES_PER_SEC = 250 * 1024; // ~2 Mbps floor
  const computeUploadTimeoutMs = (fileSizeBytes: number): number => {
    const estimated = (fileSizeBytes / ASSUMED_MIN_UPLOAD_BYTES_PER_SEC) * 1000 + 30_000;
    return Math.min(UPLOAD_MAX_TIMEOUT_MS, Math.max(UPLOAD_MIN_TIMEOUT_MS, estimated));
  };

  const uploadSingleItem = (id: string, blob: Blob, filename: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('guestId', guestId as string);
      formData.append('pass', pass);
      formData.append('files', blob, filename);

      const authHeader = auth.authorise && auth.accessToken ? `Bearer ${auth.accessToken}` : null;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/qr-moments/${eventSlug}/upload`);
      if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
      xhr.timeout = computeUploadTimeoutMs(blob.size);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.round((event.loaded / event.total) * 100);
        setUploadProgress((prev) => ({ ...prev, [id]: { status: 'uploading', progress: pct } }));
      };

      const fail = (message: string) => {
        setUploadProgress((prev) => ({ ...prev, [id]: { status: 'error', progress: 0, error: message } }));
        reject(new Error(message));
      };

      xhr.ontimeout = () => fail(`Timeout după ${xhr.timeout / 1000}s`);
      xhr.onerror = () => fail('Eroare de rețea');
      xhr.onabort = () => fail('Cerere anulată');
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let apiMessage = '';
          try { apiMessage = (JSON.parse(xhr.responseText) as { error?: string }).error ?? ''; } catch { /* ignore */ }
          fail(apiMessage ? mapQrApiError(apiMessage) : `Status ${xhr.status}`);
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText) as { error?: string };
          if (data.error) { fail(mapQrApiError(data.error)); return; }
        } catch {
          fail('Răspuns invalid de la server');
          return;
        }
        setUploadProgress((prev) => ({ ...prev, [id]: { status: 'done', progress: 100 } }));
        resolve();
      };

      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    const hasFiles = selectedFiles.length > 0 || audioBlob !== null;
    if (!hasFiles || !guestId) return;

    const isAudioTab = audioBlob !== null;
    const queue: { id: string; blob: Blob; filename: string }[] = isAudioTab
      ? (uploadProgress.audio?.status === 'done' ? [] : [{ id: 'audio', blob: audioBlob as Blob, filename: buildAudioFilename(audioBlob as Blob) }])
      : selectedFiles
          .filter(({ id }) => uploadProgress[id]?.status !== 'done')
          .map(({ id, file }) => ({ id, blob: file, filename: file.name }));

    if (queue.length === 0) return;

    setUploading(true);
    setUploadError(null);

    const failedIds = new Set<string>();
    for (const item of queue) {
      try {
        await uploadSingleItem(item.id, item.blob, item.filename);
      } catch (error) {
        failedIds.add(item.id);
        reportQrDebug('Upload failed for one file', { itemId: item.id, filename: item.filename, error: serializeDebugValue(error) });
      }
    }

    setUploading(false);

    if (failedIds.size === 0) {
      clearSelectedFiles();
      clearAudio();
      setStep('success');
      return;
    }

    if (!isAudioTab) {
      setSelectedFiles((prev) => prev.filter(({ id }) => failedIds.has(id)));
    }

    setUploadError(
      failedIds.size === queue.length
        ? 'Niciun fișier nu s-a trimis. Verifică conexiunea și încearcă din nou.'
        : `${failedIds.size} din ${queue.length} fișiere nu s-au trimis. Restul au fost deja trimise — apasă din nou pentru a reîncerca ce a mai rămas.`,
    );
  };

  const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  const renderPromoBanner = () => (
    <div className="relative left-1/2 mt-8 w-screen -translate-x-1/2">
      <div className="mx-auto max-w-sm px-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/75">AncaVisuals</p>
        <h2 className="mt-2 text-lg font-light leading-tight text-white">{getHeadlineText(eventInfo?.eventType)}</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-300">{SUBHEAD_TEXT}</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/80">{REFERRAL_TEXT}</p>
        <a
          href="/contact"
          className="mt-3 inline-flex rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-amber-200"
        >
          Hai să povestim
        </a>
      </div>
      <PortfolioGallery altBase="fotografie și videografie Anca Visuals" />
    </div>
  );

  const audioPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => { audioPreviewUrlRef.current = audioPreviewUrl; }, [audioPreviewUrl]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      stopWaveform();
      stopRecordingStream();
      clearSelectedFiles();
      if (audioPreviewUrlRef.current) URL.revokeObjectURL(audioPreviewUrlRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <svg className="animate-spin text-neutral-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
    );
  }

  if (step === 'not-found') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <p className="text-neutral-400 text-sm">Evenimentul nu există sau link-ul este invalid.</p>
          <WhatsAppHelp message="Bună! Am scanat codul QR dar primesc eroare că evenimentul nu există." />
          <a href="/" className="block text-xs text-neutral-600 underline underline-offset-4">Înapoi acasă</a>
        </div>
      </div>
    );
  }

  if (step === 'closed') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">📸</div>
          <h1 className="text-white text-lg font-light">Perioada de upload s-a închis</h1>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Timpul alocat încărcării amintirilor a trecut. Dacă dorești să încarci în continuare, ne poți contacta pe Instagram{' '}
            <a href="https://instagram.com/ancavisuals" className="text-amber-400 hover:text-amber-300" target="_blank" rel="noopener noreferrer">@ancavisuals</a>.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    const confetti = [
      ['8%', '#34d399', '0s'], ['18%', '#fbbf24', '0.18s'], ['29%', '#fb7185', '0.35s'],
      ['41%', '#60a5fa', '0.1s'], ['53%', '#a78bfa', '0.42s'], ['65%', '#34d399', '0.25s'],
      ['77%', '#fbbf24', '0.5s'], ['89%', '#fb7185', '0.12s'],
    ];
    return (
      <div className="relative min-h-screen overflow-hidden bg-neutral-950 flex items-center justify-center px-4">
        <style>{`@keyframes qr-confetti-fall { 0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(112vh) rotate(540deg); opacity: 0; } }`}</style>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
          {confetti.map(([left, color, delay], index) => (
            <span
              key={index}
              className="absolute top-0 h-3 w-1.5 rounded-sm"
              style={{ left, backgroundColor: color, animation: `qr-confetti-fall 2.6s ease-out ${delay} forwards` }}
            />
          ))}
        </div>
        <div className="max-w-sm text-center space-y-6">
          <div className="text-5xl">🎉</div>
          <div className="space-y-2">
            <h1 className="text-white text-3xl font-semibold tracking-wide">MATERIALE ÎNCĂRCATE</h1>
            <p className="text-emerald-400 text-sm font-medium">Mulțumim!</p>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Fișierele tale au ajuns la miri. Dacă lasă un comentariu, vei primi un email.
            </p>
          </div>
          <button
            onClick={() => { setStep('upload'); setSelectedFiles([]); clearAudio(); }}
            className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-300 transition-colors"
          >
            Trimite mai multe
          </button>
          {renderPromoBanner()}
        </div>
      </div>
    );
  }

  const coupleLabel = eventInfo?.bride && eventInfo?.groom ? `${eventInfo.bride} & ${eventInfo.groom}` : eventSlug;
  const normalizedEventType = normalizeQrEventType(eventInfo?.eventType);

  if (step === 'form') {
    return (
      <div className="min-h-screen bg-neutral-950 px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <div className="text-3xl mb-3">✨</div>
            <h1 className="text-white text-xl font-light">QR Moments</h1>
            <p className="text-neutral-500 text-sm">{coupleLabel}</p>
            {eventInfo?.deadline && <p className="text-neutral-700 text-xs">Upload deschis până la {new Date(eventInfo.deadline).toLocaleString('ro-RO')}</p>}
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="qr-guest-name" className="text-neutral-400 text-xs mb-1 block">Numele tău *</label>
              <input
                id="qr-guest-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Maria Ionescu"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label htmlFor="qr-guest-email" className="text-neutral-400 text-xs mb-1 block">Email *</label>
              <input
                id="qr-guest-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="maria@exemplu.ro"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
              />
              <p className="text-neutral-600 text-xs mt-1">Necesar pentru a primi răspunsul mirilor.</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Accept prelucrarea datelor cu caracter personal *"
                checked={gdprConsent}
                onChange={(event) => setGdprConsent(event.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <p className="text-neutral-300 text-xs">Accept prelucrarea datelor cu caracter personal *</p>
                <p className="text-neutral-600 text-xs mt-0.5">
                  Numele și emailul sunt folosite exclusiv pentru funcționarea acestui serviciu. Nu sunt transmise terților. Responsabil: AncaVisuals. (GDPR Art. 6.1.a)
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Sunt de acord să primesc notificări prin email (opțional)"
                checked={emailConsent}
                onChange={(event) => setEmailConsent(event.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <p className="text-neutral-300 text-xs">Sunt de acord să primesc notificări prin email <span className="text-neutral-500">(opțional)</span></p>
                <p className="text-neutral-600 text-xs mt-0.5">
                  Vei primi un email când mirii comentează la ce ai încărcat. Te poți dezabona oricând. (Directiva ePrivacy + GDPR Art. 7)
                </p>
              </div>
            </label>
          </div>

          {formError && (
            <div className="space-y-2">
              <p className="text-red-400 text-xs">{formError}</p>
              <WhatsAppHelp message="Bună! Am o problemă la înregistrarea pe QR Moments." />
            </div>
          )}

          <button
            onClick={handleFormSubmit}
            disabled={formLoading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-medium rounded-xl text-sm transition-colors"
          >
            {formLoading ? 'Se verifică...' : 'Continuă →'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-sm mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-white text-xl font-light">QR Moments</h1>
          <p className="text-neutral-500 text-sm">{coupleLabel}</p>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 px-4 py-4 text-center space-y-1">
          <p className="text-amber-200 text-sm font-medium">Lasă o amintire pentru {getHostsPairLabel(eventInfo?.eventType)} 💛</p>
          <p className="text-neutral-400 text-xs leading-relaxed">
            {normalizedEventType === 'corporate'
              ? 'Încarcă fotografii, videoclipuri sau un mesaj despre eveniment.'
              : 'Ei se vor bucura să vadă o urare video sau vocală pe care tu o faci din toată inima pentru ei.'}
          </p>
        </div>

        {(normalizedEventType === 'nunta' || normalizedEventType === 'botez') && (() => {
          const weddingSuggestions = [
            { emoji: "🏡", title: "Urare de casă de piatră", desc: "Spune-le ce îți dorești pentru căminul lor nou." },
            { emoji: "📖", title: "O amintire cu ei", desc: "Povestește un moment pe care l-ai trăit alături de ei." },
            { emoji: "🥂", title: "Un toast din suflet", desc: "Ridică paharul și spune câteva cuvinte sincere." },
            { emoji: "💌", title: "Mesaj pentru viitor", desc: "Ce le dorești să trăiască împreună peste 10 ani?" },
            { emoji: "👶", title: "Copii frumoși și sănătoși", desc: "Urează-le să aibă copii cu ochii mari și inima bună." },
            { emoji: "🌟", title: "Sfatul tău de viață", desc: "Ce lecție despre dragoste ai vrea să le transmiți?" },
            { emoji: "😂", title: "O glumă sau amintire haioasă", desc: "Fă-i să râdă — cele mai bune momente sunt cele cu zâmbet." },
          ];
          const baptismSuggestions = [
            { emoji: "👶", title: "Urare pentru cel mic", desc: "Spune-i ce îi dorești pentru viața care abia începe." },
            { emoji: "🙏", title: "O binecuvântare", desc: "Lasă-le un gând bun sau o rugăciune pentru copil și părinți." },
            { emoji: "📖", title: "O amintire cu părinții", desc: "Povestește un moment frumos trăit alături de ei." },
            { emoji: "🥂", title: "Un toast din suflet", desc: "Ridică paharul și spune câteva cuvinte sincere pentru familie." },
            { emoji: "💌", title: "Mesaj pentru viitor", desc: "Ce speri să trăiască el/ea peste 20 de ani?" },
            { emoji: "🌟", title: "Sfatul tău de viață", desc: "Ce lecție ai vrea să-i transmiți celui mic când va crește?" },
            { emoji: "😂", title: "O glumă sau amintire haioasă", desc: "Fă-i să râdă — cele mai bune momente sunt cele cu zâmbet." },
          ];
          const suggestions = normalizedEventType === 'botez' ? baptismSuggestions : weddingSuggestions;
          const current = suggestions[suggestionIndex % suggestions.length];
          return (
            <div className="space-y-2">
              <p className="text-neutral-500 text-[10px] uppercase tracking-widest font-medium px-1">Sugestii de încărcat</p>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors text-lg shrink-0 w-7 text-center"
                  >
                    ‹
                  </button>
                  <div className="flex-1 text-center space-y-1.5 min-h-[72px] flex flex-col justify-center">
                    <span className="text-2xl">{current.emoji}</span>
                    <p className="text-white text-xs font-medium leading-tight">{current.title}</p>
                    <p className="text-neutral-500 text-[11px] leading-snug">{current.desc}</p>
                  </div>
                  <button
                    onClick={() => setSuggestionIndex((i) => (i + 1) % suggestions.length)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors text-lg shrink-0 w-7 text-center"
                  >
                    ›
                  </button>
                </div>
                <div className="flex justify-center gap-1.5 mt-3">
                  {suggestions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSuggestionIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === suggestionIndex ? 'bg-neutral-300' : 'bg-neutral-700'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex gap-1 bg-neutral-900 rounded-xl p-1">
          {(['photo', 'video', 'audio'] as MediaTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setMediaTab(tab); clearSelectedFiles(); clearAudio(); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${mediaTab === tab ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {tab === 'photo' ? '📸 Poze' : tab === 'video' ? '🎥 Video' : '🎤 Mesaj'}
            </button>
          ))}
        </div>

        {(mediaTab === 'photo' || mediaTab === 'video') && (
          <div className="space-y-4">
            <button
              onClick={() => openFilePicker(mediaTab === 'photo'
                ? 'image/*,.heic,.heif,.jpg,.jpeg,.png,.webp'
                : 'video/*,.mov,.hevc,.m4v,.mp4,.avi,.mkv'
              )}
              className="w-full py-8 border border-dashed border-emerald-500/50 bg-emerald-500/5 rounded-xl text-emerald-300 text-sm font-medium hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors"
            >
              {mediaTab === 'photo' ? '+ Alege poze' : '+ Alege clipuri'}
            </button>
            <p className="text-center text-neutral-600 text-[11px]">
              Limită: maximum {MAX_UPLOAD_FILE_SIZE_MB} MB pentru fiecare fișier. Nu există limită totală pentru selecție.
            </p>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-neutral-500 text-xs">{selectedFiles.length} fișier(e) selectate</p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedFiles.map(({ id, file, previewUrl }) => {
                    const progress = uploadProgress[id];
                    return (
                      <div key={id} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-800">
                        {DISPLAYABLE_IMAGE.includes(file.type) ? (
                          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                        ) : DISPLAYABLE_VIDEO.includes(file.type) ? (
                          <video src={previewUrl} className="w-full h-full object-cover" muted />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs text-center px-1">{file.name}</div>
                        )}

                        {progress?.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 px-2">
                            <div className="w-4/5 h-1 rounded-full bg-white/20 overflow-hidden">
                              <div
                                className="h-full bg-amber-400 transition-all duration-150"
                                style={{ width: `${progress.progress}%` }}
                              />
                            </div>
                            <span className="text-white text-[10px] font-medium">{progress.progress}%</span>
                          </div>
                        )}

                        {progress?.status === 'error' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center px-2">
                            <span className="text-red-400 text-[10px] font-medium text-center leading-tight">Eroare, reîncearcă</span>
                          </div>
                        )}

                        {progress?.status === 'done' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">✓</span>
                          </div>
                        )}

                        {!uploading && (
                          <button
                            onClick={() => removeFile(id)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-white text-xs flex items-center justify-center"
                            aria-label="Elimină"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {mediaTab === 'audio' && (
          <div className="space-y-4">
            {audioPermission === 'denied' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 space-y-3">
                <p className="text-red-400 text-xs">Accesul la microfon este blocat. Activează-l din setările browserului sau contactează-ne.</p>
                <WhatsAppHelp message="Bună! Nu pot activa microfonul pe QR Moments. Mă poți ajuta?" />
              </div>
            )}

            {audioPermission === 'unknown' && !isRecording && !audioBlob && (
              <button
                onClick={requestMicPermission}
                className="w-full py-8 border border-dashed border-emerald-600/50 rounded-xl text-emerald-400 text-sm hover:border-emerald-500 hover:bg-emerald-500/5 transition-colors"
              >
                🎤 Permite accesul la microfon
              </button>
            )}

            {audioPermission === 'granted' && !isRecording && !audioBlob && (
              <button
                onClick={startRecording}
                className="w-full py-8 border border-dashed border-neutral-700 rounded-xl text-neutral-400 text-sm hover:border-amber-500/40 hover:text-amber-400 transition-colors"
              >
                🎙 Începe înregistrarea
              </button>
            )}

            {isRecording && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 justify-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm">Se înregistrează… {recordingSecondsLeft}s</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-amber-500/20 bg-neutral-900 shadow-[0_0_0_1px_rgba(245,158,11,0.04)]">
                  <canvas
                    ref={waveformCanvasRef}
                    className="block h-28 w-full"
                    aria-label="Waveform live microfon"
                  />
                </div>
                <p className="text-center text-[11px] text-neutral-500">
                  Wave-ul se mișcă live cât timp vorbești.
                </p>
                <button
                  onClick={stopRecording}
                  className="w-full py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-300 text-sm hover:border-neutral-500 transition-colors"
                >
                  Stop & Previzualizare
                </button>
              </div>
            )}

            {audioBlob && audioPreviewUrl && (
              <div className="space-y-3">
                <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 space-y-3">
                  <p className="text-neutral-400 text-xs">Previzualizare mesaj vocal</p>
                  <audio
                    ref={audioPlayerRef}
                    src={audioPreviewUrl}
                    onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime)}
                    onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration)}
                    onEnded={() => setIsPlayingAudio(false)}
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (isPlayingAudio) { audioPlayerRef.current?.pause(); }
                        else { audioPlayerRef.current?.play(); }
                        setIsPlayingAudio(!isPlayingAudio);
                      }}
                      className="w-8 h-8 flex items-center justify-center bg-neutral-800 rounded-full text-white text-xs hover:bg-neutral-700 transition-colors"
                    >
                      {isPlayingAudio ? '❚❚' : '▶'}
                    </button>
                    <span className="text-neutral-500 text-xs">{formatSeconds(audioCurrentTime)} / {formatSeconds(audioDuration)}</span>
                  </div>

                  {uploadProgress.audio?.status === 'uploading' && (
                    <div className="space-y-1">
                      <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-150"
                          style={{ width: `${uploadProgress.audio.progress}%` }}
                        />
                      </div>
                      <span className="text-neutral-500 text-[10px]">{uploadProgress.audio.progress}%</span>
                    </div>
                  )}
                  {uploadProgress.audio?.status === 'error' && (
                    <p className="text-red-400 text-[10px]">Eroare la trimitere, apasă din nou pe „Trimite”.</p>
                  )}
                  {uploadProgress.audio?.status === 'done' && (
                    <p className="text-emerald-400 text-[10px]">✓ Trimis</p>
                  )}
                </div>
                {!uploading && (
                  <button onClick={clearAudio} className="text-xs text-neutral-600 underline underline-offset-4 hover:text-neutral-400 transition-colors">
                    Înregistrează din nou
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div className="space-y-2">
            <p className="text-red-400 text-xs">{uploadError}</p>
            <WhatsAppHelp message="Bună! Am o problemă la încărcarea fișierelor pe QR Moments." />
          </div>
        )}

        {(selectedFiles.length > 0 || audioBlob) && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-medium rounded-xl text-sm transition-colors"
          >
            {uploading ? 'Se trimite…' : `Trimite ${audioBlob ? 'mesajul vocal' : `${selectedFiles.length} fișier(e)`}`}
          </button>
        )}

        <p className="text-neutral-700 text-xs text-center">
          Creat cu drag de <span className="text-neutral-500">AncaVisuals</span>
        </p>

        {renderPromoBanner()}
      </div>
    </div>
  );
}
