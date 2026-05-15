import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getDownloadURL, listAll, ref } from 'firebase/storage';
import useAuth from '../../features/admin/auth/useAuth';
import { storage } from '../../firebase';

type Step = 'loading' | 'closed' | 'not-found' | 'form' | 'upload' | 'success';
type MediaTab = 'photo' | 'video' | 'audio';

interface EventInfo {
  bride: string | null;
  groom: string | null;
  isOpen: boolean;
  deadline: string;
}

interface SelectedFile {
  file: File;
  previewUrl: string;
}

interface PromoImage {
  id: string;
  url: string;
  altText: string;
}

type LegacyAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const DISPLAYABLE_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const DISPLAYABLE_VIDEO = ['video/mp4'];
const DISPLAYABLE_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
const PORTFOLIO_GALLERY_FOLDER = 'ancavisuals/PortfolioGallery';

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

const HEADLINE_TEXT = 'Ești mireasă, mire sau cunoști pe cineva care își pregătește nunta?';
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
  const [galleryImages, setGalleryImages] = useState<PromoImage[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const [guestId, setGuestId] = useState<string | null>(null);
  const [mediaTab, setMediaTab] = useState<MediaTab>('photo');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
  const touchStartXRef = useRef<number | null>(null);
  const consoleBufferRef = useRef<string[]>([]);
  const debugSentRef = useRef<Set<string>>(new Set());

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
  };

  const goToNextGalleryImage = () => {
    setGalleryIndex((prev) => (galleryImages.length > 0 ? (prev + 1) % galleryImages.length : 0));
  };

  const goToPreviousGalleryImage = () => {
    setGalleryIndex((prev) => (galleryImages.length > 0 ? (prev - 1 + galleryImages.length) % galleryImages.length : 0));
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

    const url = auth.authorise && auth.accessToken
      ? `/api/qr-moments/${eventSlug}`
      : `/api/qr-moments/${eventSlug}?pass=${encodeURIComponent(pass)}`;
    const headers: Record<string, string> = {};
    if (auth.authorise && auth.accessToken) headers['Authorization'] = `Bearer ${auth.accessToken}`;

    fetch(url, { headers })
      .then((r) => r.json())
      .then((data: EventInfo & { error?: string }) => {
        if (data.error) { setStep('not-found'); return; }
        setEventInfo(data);
        setStep(data.isOpen ? 'form' : 'closed');
      })
      .catch((error) => {
        reportQrDebug('Initial event lookup failed', { error: serializeDebugValue(error) });
        setStep('not-found');
      });
  }, [eventSlug, pass, auth.authorise, auth.accessToken, auth.loading]);

  useEffect(() => {
    let cancelled = false;

    const loadPromoImages = async () => {
      try {
        const folderRef = ref(storage, PORTFOLIO_GALLERY_FOLDER);
        const result = await listAll(folderRef);
        const urls = await Promise.all(result.items.slice(0, 8).map(async (item, index) => ({
          id: `${item.name}-${index}`,
          url: await getDownloadURL(item),
          altText: 'AncaVisuals wedding moment',
        })));

        if (!cancelled) setGalleryImages(urls);
      } catch {
        if (!cancelled) setGalleryImages([]);
      }
    };

    loadPromoImages();

    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (galleryImages.length <= 1) return;
    const interval = window.setInterval(() => {
      setGalleryIndex((prev) => (prev + 1) % galleryImages.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [galleryImages]);

  useEffect(() => {
    if (galleryIndex >= galleryImages.length) setGalleryIndex(0);
  }, [galleryImages, galleryIndex]);

  // Admin flow: auto-register and jump straight to the upload step.
  useEffect(() => {
    if (step !== 'form' || !auth.authorise || !auth.accessToken) return;
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
        }
      })
      .catch((error) => {
        reportQrDebug('Admin auto-register network failure', { error: serializeDebugValue(error) });
        setFormError('Eroare de rețea la auto-înregistrare admin.');
      });
  }, [step, auth.authorise, auth.accessToken]);

  const handleFormSubmit = async () => {
    setFormError(null);
    if (!name.trim() || !email.trim()) { setFormError('Completează numele și emailul.'); return; }
    if (!gdprConsent || !emailConsent) { setFormError('Acordă ambele consimțăminte pentru a continua.'); return; }

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
    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.files) return;
      const newFiles: SelectedFile[] = Array.from(target.files).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    };
    input.click();
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
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
  };

  const handleUpload = async () => {
    const hasFiles = selectedFiles.length > 0 || audioBlob !== null;
    if (!hasFiles || !guestId) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('guestId', guestId);
    formData.append('pass', pass);

    if (audioBlob) {
      const blobType = audioBlob.type || '';
      const ext = blobType.includes('mp4') || blobType.includes('m4a') ? 'm4a'
        : blobType.includes('ogg') ? 'ogg'
        : blobType.includes('webm') ? 'webm'
        : 'm4a';
      formData.append('files', audioBlob, `voice-${Date.now()}.${ext}`);
    } else {
      selectedFiles.forEach(({ file }) => formData.append('files', file));
    }

    const uploadHeaders: Record<string, string> = {};
    if (auth.authorise && auth.accessToken) uploadHeaders['Authorization'] = `Bearer ${auth.accessToken}`;

    try {
      const result = await fetch(`/api/qr-moments/${eventSlug}/upload`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      }).then((r) => r.json());

      if (result.error) {
        reportQrDebug('Upload failed with API error', { apiError: result.error });
        setUploadError(mapQrApiError(result.error));
        return;
      }

      clearSelectedFiles();
      clearAudio();
      setStep('success');
    } catch (error) {
      reportQrDebug('Upload failed with network/runtime error', { error: serializeDebugValue(error) });
      setUploadError('Eroare la upload. Încearcă din nou.');
    } finally {
      setUploading(false);
    }
  };

  const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  const renderPromoBanner = () => (
    <div className="overflow-hidden rounded-[24px] border border-amber-200/10 bg-neutral-950 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <div className="grid gap-0 sm:grid-cols-[0.95fr_1.05fr]">
        <div className="relative min-h-[220px] bg-neutral-900">
          {galleryImages.length > 0 ? (
            <>
              <div
                className="h-full overflow-hidden"
                onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                  const startX = touchStartXRef.current;
                  const endX = event.changedTouches[0]?.clientX ?? null;
                  touchStartXRef.current = null;
                  if (startX === null || endX === null) return;
                  const delta = endX - startX;
                  if (Math.abs(delta) < 50) return;
                  if (delta < 0) goToNextGalleryImage();
                  else goToPreviousGalleryImage();
                }}
              >
                <div
                  className="flex h-full transition-transform duration-700 ease-out"
                  style={{ transform: `translateX(-${galleryIndex * 100}%)` }}
                >
                  {galleryImages.map((image) => (
                    <div key={image.id} className="h-full w-full shrink-0">
                      <img
                        src={image.url}
                        alt={image.altText || 'AncaVisuals wedding moment'}
                        className="h-full min-h-[220px] w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousGalleryImage}
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
                    aria-label="Poza anterioară"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={goToNextGalleryImage}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
                    aria-label="Poza următoare"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2 py-1 backdrop-blur">
                    {galleryImages.slice(0, 5).map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setGalleryIndex(index)}
                        className={`h-1.5 rounded-full transition-all ${galleryIndex === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`}
                        aria-label={`Mergi la poza ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[220px] items-end bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.3),_transparent_45%),linear-gradient(135deg,_#171717_0%,_#0a0a0a_100%)] p-4">
              <p className="max-w-[180px] text-xs uppercase tracking-[0.25em] text-amber-200/80">
                Foto. Video. Momente care rămân.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center space-y-2 p-4 sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/75">AncaVisuals</p>
          <div className="space-y-1">
            <h2 className="text-lg font-light leading-[0.9] text-white">{HEADLINE_TEXT}</h2>
            <p className="text-sm leading-[1.05] text-neutral-300">{SUBHEAD_TEXT}</p>
            <p className="text-xs leading-[1.02] text-amber-100/80">
              {REFERRAL_TEXT}
            </p>
          </div>
          <div className="pt-1">
            <a
              href="/contact"
              className="inline-flex rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-amber-200"
            >
              Hai să povestim
            </a>
          </div>
        </div>
      </div>
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
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-6">
          <div className="text-5xl">🎉</div>
          <div className="space-y-2">
            <h1 className="text-white text-xl font-light">Mulțumim!</h1>
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
                aria-label="Sunt de acord să primesc notificări prin email *"
                checked={emailConsent}
                onChange={(event) => setEmailConsent(event.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <div>
                <p className="text-neutral-300 text-xs">Sunt de acord să primesc notificări prin email *</p>
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
          <p className="text-amber-200 text-sm font-medium">Lasă o amintire pentru mire și mireasă 💛</p>
          <p className="text-neutral-400 text-xs leading-relaxed">
            Ei se vor bucura să vadă o urare video sau vocală pe care tu o faci din toată inima pentru ei.
          </p>
        </div>

        {(() => {
          const suggestions = [
            { emoji: "🏡", title: "Urare de casă de piatră", desc: "Spune-le ce îți dorești pentru căminul lor nou." },
            { emoji: "📖", title: "O amintire cu ei", desc: "Povestește un moment pe care l-ai trăit alături de ei." },
            { emoji: "🥂", title: "Un toast din suflet", desc: "Ridică paharul și spune câteva cuvinte sincere." },
            { emoji: "💌", title: "Mesaj pentru viitor", desc: "Ce le dorești să trăiască împreună peste 10 ani?" },
            { emoji: "👶", title: "Copii frumoși și sănătoși", desc: "Urează-le să aibă copii cu ochii mari și inima bună." },
            { emoji: "🌟", title: "Sfatul tău de viață", desc: "Ce lecție despre dragoste ai vrea să le transmiți?" },
            { emoji: "😂", title: "O glumă sau amintire haioasă", desc: "Fă-i să râdă — cele mai bune momente sunt cele cu zâmbet." },
          ];
          const current = suggestions[suggestionIndex];
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
              onClick={() => openFilePicker(mediaTab === 'photo' ? 'image/*' : 'video/*')}
              className="w-full py-8 border border-dashed border-neutral-700 rounded-xl text-neutral-400 text-sm hover:border-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {mediaTab === 'photo' ? '+ Alege poze' : '+ Alege clipuri'}
            </button>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-neutral-500 text-xs">{selectedFiles.length} fișier(e) selectate</p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedFiles.map(({ file, previewUrl }, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-neutral-800">
                      {DISPLAYABLE_IMAGE.includes(file.type) ? (
                        <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                      ) : DISPLAYABLE_VIDEO.includes(file.type) ? (
                        <video src={previewUrl} className="w-full h-full object-cover" muted />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs text-center px-1">{file.name}</div>
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-white text-xs flex items-center justify-center"
                        aria-label="Elimină"
                      >
                        ×
                      </button>
                    </div>
                  ))}
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
                </div>
                <button onClick={clearAudio} className="text-xs text-neutral-600 underline underline-offset-4 hover:text-neutral-400 transition-colors">
                  Înregistrează din nou
                </button>
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
