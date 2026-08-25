import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import useAuth from '../../features/admin/auth/useAuth';
import { getHostRoleLabel, normalizeQrEventType, type QrEventType } from '../../../shared/qrMoments/hostRoles';

interface Upload {
  id: string;
  type: 'photo' | 'video' | 'audio';
  bunnyUrl: string;
  mimeType: string;
  originalName: string;
  createdAt: string;
  thankedAt: string | null;
}

interface GuestGroup {
  guest: { id: string; name: string; hasEmail: boolean };
  uploads: Upload[];
}

interface Comment {
  id: string;
  text: string;
  fromHost: boolean;
  hostRole?: 'bride' | 'groom' | null;
  createdAt: string;
}

interface GalleryEventInfo {
  bride: string | null;
  groom: string | null;
  eventType: QrEventType;
}

function isHeicUpload(upload: Upload): boolean {
  const mime = upload.mimeType.toLowerCase();
  const ext = upload.originalName.toLowerCase().split('.').pop() ?? '';
  return mime.includes('heic') || mime.includes('heif') || ext === 'heic' || ext === 'heif';
}

const QUICK_REPLIES_FALLBACK = [
  'Mulțumim pentru mesaj! Vă iubim',
  'Îți mulțumim din suflet!',
  'Ce surpriză minunată, mulțumim!',
  'Mulțumim, înseamnă enorm pentru noi!',
];

const THANK_SUGGESTIONS = [
  'Mulțumim frumos pentru această amintire!',
  'Îți mulțumim din suflet, înseamnă enorm pentru noi!',
  'Ce surpriză minunată, ne bucurăm că ai fost alături de noi!',
];

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function GalleryUpdatesSignup({ eventSlug, pin, hidden }: { eventSlug: string; pin: string; hidden: boolean }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  if (hidden || status === 'success') {
    return status === 'success' ? <p className="text-emerald-400 text-xs">Te-ai înscris. Vei primi update-uri când apar materiale noi.</p> : null;
  }

  const subscribe = async () => {
    if (!email.trim() || !consent || status === 'sending') return;
    setStatus('sending');
    try {
      const response = await fetch(`/api/qr-moments/${eventSlug}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), pin, consent: true }),
      });
      setStatus(response.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 space-y-3">
      <div>
        <p className="text-white text-sm">Primește update-uri despre galerie</p>
        <p className="text-neutral-500 text-xs mt-1">Înscrie-te dacă vrei să afli când apar materiale noi.</p>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@exemplu.ro"
          className="min-w-0 flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={subscribe}
          disabled={!email.trim() || !consent || status === 'sending'}
          className="px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-medium disabled:opacity-40"
        >
          {status === 'sending' ? 'Se salvează…' : 'Înscrie-mă'}
        </button>
      </div>
      <label className="flex items-start gap-2 text-[11px] text-neutral-500">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 accent-amber-400" />
        Sunt de acord să primesc notificări despre această galerie. Mă pot dezabona ulterior.
      </label>
      {status === 'error' && <p className="text-red-400 text-xs">Nu am putut salva înscrierea. Încearcă din nou.</p>}
    </div>
  );
}

function MediaThumbnail({ upload, onClick }: { upload: Upload; onClick: () => void }) {
  if (upload.type === 'photo') {
    if (isHeicUpload(upload)) {
      return (
        <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg bg-neutral-800 flex flex-col items-center justify-center gap-2 hover:bg-neutral-700 transition-colors w-full">
          <span className="text-2xl">🖼️</span>
          <span className="text-neutral-500 text-xs">Poză HEIC</span>
        </button>
      );
    }
    return (
      <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg overflow-hidden bg-neutral-800 hover:opacity-80 transition-opacity w-full">
        <img src={upload.bunnyUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </button>
    );
  }
  if (upload.type === 'video') {
    return (
      <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg overflow-hidden bg-neutral-800 relative hover:opacity-80 transition-opacity w-full">
        <video src={upload.bunnyUrl} className="w-full h-full object-cover" muted preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white text-xs">▶</div>
        </div>
      </button>
    );
  }
  return (
    <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg bg-neutral-800 flex flex-col items-center justify-center gap-2 hover:bg-neutral-700 transition-colors w-full">
      <span className="text-2xl">🎙</span>
      <span className="text-neutral-500 text-xs">Mesaj vocal</span>
    </button>
  );
}

function ThankModal({
  upload,
  eventSlug,
  pin,
  adminToken,
  eventInfo,
  onClose,
  onThanked,
}: {
  upload: Upload;
  eventSlug: string;
  pin: string;
  adminToken?: string;
  eventInfo: GalleryEventInfo | null;
  onClose: () => void;
  onThanked: (uploadId: string, thankedAt: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [hostRole, setHostRole] = useState<'bride' | 'groom'>('bride');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const result = await fetch(`/api/qr-moments/thank/${upload.id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventSlug, pin, message: text.trim(), hostRole }),
      }).then((response) => response.json());
      if (!result.error) {
        setSent(true);
        onThanked(upload.id, result.thankedAt ?? new Date().toISOString());
        setTimeout(onClose, 1500);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-4" onClick={(event) => event.stopPropagation()}>
        {sent ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✓</div>
            <p className="text-amber-300 font-medium">Mulțumire trimisă!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-white text-sm font-medium">✉ Trimite mulțumire</p>
              <button onClick={onClose} className="text-neutral-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-neutral-500">Din partea</span>
              <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-900 p-1">
                {([
                  { value: 'bride' as const, label: eventInfo?.bride?.trim() || getHostRoleLabel(eventInfo?.eventType, 'bride') },
                  ...(normalizeQrEventType(eventInfo?.eventType) === 'corporate' ? [] : [
                    { value: 'groom' as const, label: eventInfo?.groom?.trim() || getHostRoleLabel(eventInfo?.eventType, 'groom') },
                  ]),
                ]).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setHostRole(option.value)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      hostRole === option.value ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {THANK_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  disabled={sending}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-amber-500/40 hover:text-amber-200 disabled:opacity-50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') send(message); }}
                placeholder="Sau scrie un mesaj personalizat…"
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
              />
              <button
                onClick={() => send(message)}
                disabled={!message.trim() || sending}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-sm font-medium rounded-lg transition-colors"
              >
                Trimite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AssetModal({
  upload,
  allUploads,
  eventSlug,
  pin,
  adminToken,
  hasAdminBar,
  quickReplies,
  eventInfo,
  onClose,
  onNavigate,
}: {
  upload: Upload;
  allUploads: Upload[];
  eventSlug: string;
  pin: string;
  adminToken?: string;
  hasAdminBar: boolean;
  quickReplies: string[];
  eventInfo: GalleryEventInfo | null;
  onClose: () => void;
  onNavigate: (upload: Upload) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [hostRole, setHostRole] = useState<'bride' | 'groom'>('bride');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const selectedHostName = hostRole === 'groom'
    ? (eventInfo?.groom?.trim() || getHostRoleLabel(eventInfo?.eventType, 'groom'))
    : (eventInfo?.bride?.trim() || getHostRoleLabel(eventInfo?.eventType, 'bride'));
  const currentIndex = allUploads.findIndex((item) => item.id === upload.id);
  const previousUpload = currentIndex > 0 ? allUploads[currentIndex - 1] : null;
  const nextUpload = currentIndex >= 0 && currentIndex < allUploads.length - 1 ? allUploads[currentIndex + 1] : null;

  // Fire view notification once when photo is opened; video/audio use onPlay
  useEffect(() => {
    if (upload.type !== 'photo') return;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    fetch(`/api/qr-moments/view-notify/${upload.id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventSlug, pin }),
    }).catch(() => {});
  }, [upload.id, upload.mimeType, adminToken, eventSlug, pin]);

  useEffect(() => {
    const headers: Record<string, string> = {};
    const url = adminToken
      ? `/api/qr-moments/comment/${upload.id}?eventSlug=${encodeURIComponent(eventSlug)}`
      : `/api/qr-moments/comment/${upload.id}?eventSlug=${encodeURIComponent(eventSlug)}&pin=${encodeURIComponent(pin)}`;
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

    fetch(url, { headers })
      .then((r) => r.json())
      .then((data: { comments: Comment[] }) => setComments(data.comments ?? []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [adminToken, eventSlug, pin, upload.id]);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && previousUpload) onNavigate(previousUpload);
      if (event.key === 'ArrowRight' && nextUpload) onNavigate(nextUpload);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextUpload, onNavigate, previousUpload]);

  const firePlayNotification = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    fetch(`/api/qr-moments/view-notify/${upload.id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventSlug, pin }),
    }).catch(() => {});
  };

  const sendComment = async (text: string) => {
    if (!text.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const result = await fetch('/api/qr-moments/comment', {
        method: 'POST',
        headers,
        body: JSON.stringify({ uploadId: upload.id, eventSlug, pin, text: text.trim(), hostRole }),
      }).then((r) => r.json());

      if (!result.error) {
        setComments((prev) => [
          ...prev,
          { id: Date.now().toString(), text: text.trim(), fromHost: true, hostRole, createdAt: new Date().toISOString() },
        ]);
        setCommentText('');
      }
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/90 flex flex-col" onClick={onClose}>
      <div
        className={`h-full min-h-0 flex flex-col max-w-lg mx-auto w-full overflow-hidden ${hasAdminBar ? 'pt-12' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-neutral-950/95 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => previousUpload && onNavigate(previousUpload)}
              disabled={!previousUpload}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-300 shadow-lg shadow-black/20 transition-all hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
              aria-label="Upload anterior"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => nextUpload && onNavigate(nextUpload)}
              disabled={!nextUpload}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-300 shadow-lg shadow-black/20 transition-all hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
              aria-label="Upload următor"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <div className="ml-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/70">QR Moments</p>
              <p className="mt-0.5 text-xs text-neutral-400">{currentIndex + 1} din {allUploads.length} · {formatTime(upload.createdAt)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide materialul"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-2xl font-light leading-none text-neutral-400 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-95"
          >
            ×
          </button>
        </div>

        <div className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-3 sm:p-4">
            {upload.type === 'photo' && isHeicUpload(upload) && (
              <div className="bg-neutral-900 rounded-lg p-6 text-center space-y-3">
                <span className="text-3xl block">🖼️</span>
                <p className="text-neutral-400 text-sm">
                  Această poză e în format HEIC și nu poate fi previzualizată direct în browser.
                </p>
                <a
                  href={upload.bunnyUrl}
                  download={upload.originalName}
                  className="inline-block px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  Descarcă poza
                </a>
              </div>
            )}
            {upload.type === 'photo' && !isHeicUpload(upload) && (
              <img src={upload.bunnyUrl} alt="" className="w-full rounded-lg" />
            )}
            {upload.type === 'video' && (
              <div className="relative flex h-[38dvh] min-h-[220px] max-h-[420px] justify-center overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/30 sm:h-[min(65vh,520px)]">
                <video
                  ref={videoRef}
                  src={upload.bunnyUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  onPlay={() => { setVideoPlaying(true); firePlayNotification(); }}
                  onPause={() => setVideoPlaying(false)}
                  onEnded={() => setVideoPlaying(false)}
                />
                {!videoPlaying && (
                  <button
                    type="button"
                    aria-label="Redă videoclipul"
                    onClick={() => { void videoRef.current?.play(); }}
                    className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-3xl text-black shadow-xl transition-transform hover:scale-105"
                  >
                    ▶
                  </button>
                )}
              </div>
            )}
            {upload.type === 'audio' && (
              <div className="bg-neutral-900 rounded-lg p-4">
                <audio
                  src={upload.bunnyUrl}
                  controls
                  className="w-full"
                  onPlay={firePlayNotification}
                />
              </div>
            )}
            {!(upload.type === 'photo' && isHeicUpload(upload)) && (
              <a
                href={upload.bunnyUrl}
                download={upload.originalName}
                className="mt-3 inline-block px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-sm hover:border-neutral-500 hover:text-white transition-colors"
              >
                Descarcă {upload.type === 'photo' ? 'poza' : upload.type === 'video' ? 'video-ul' : 'mesajul vocal'}
              </a>
            )}
          </div>

          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70">
              <div className="border-b border-neutral-800 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Comentarii</p>
              </div>
              <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2">
                {commentsLoading ? (
                  <p className="text-neutral-600 text-xs">Se încarcă comentariile…</p>
                ) : comments.length === 0 ? (
                  <p className="text-neutral-700 text-xs">Niciun comentariu încă.</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={`rounded-lg px-3 py-2 text-sm ${comment.fromHost ? 'bg-amber-500/10 border border-amber-500/20 text-amber-100' : 'bg-neutral-800 text-neutral-300'}`}>
                      {comment.fromHost && (
                        <p className="mb-1 text-[11px] uppercase tracking-wide text-amber-300/80">
                          {comment.hostRole === 'groom'
                            ? (eventInfo?.groom?.trim() || getHostRoleLabel(eventInfo?.eventType, 'groom'))
                            : (eventInfo?.bride?.trim() || getHostRoleLabel(eventInfo?.eventType, 'bride'))}
                        </p>
                      )}
                      <p>{comment.text}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{formatTime(comment.createdAt)}</p>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 max-h-[45dvh] overflow-y-auto border-t border-neutral-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-3 sm:max-h-none sm:overflow-visible sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => previousUpload && onNavigate(previousUpload)}
              disabled={!previousUpload}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 disabled:opacity-30"
            >
              ‹ Anterior
            </button>
            <span className="text-[10px] text-neutral-600">Navighează între materiale</span>
            <button
              type="button"
              onClick={() => nextUpload && onNavigate(nextUpload)}
              disabled={!nextUpload}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 disabled:opacity-30"
            >
              Următor ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">Trimite ca</span>
            <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-900 p-1">
              {([
                { value: 'bride', label: eventInfo?.bride?.trim() || getHostRoleLabel(eventInfo?.eventType, 'bride') },
                ...(normalizeQrEventType(eventInfo?.eventType) === 'corporate' ? [] : [
                  { value: 'groom', label: eventInfo?.groom?.trim() || getHostRoleLabel(eventInfo?.eventType, 'groom') },
                ]),
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHostRole(option.value as 'bride' | 'groom')}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    hostRole === option.value
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(quickReplies.length ? quickReplies : QUICK_REPLIES_FALLBACK).map((reply) => (
              <button
                key={reply}
                onClick={() => sendComment(reply)}
                disabled={sendingComment}
                className="px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 text-xs hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') sendComment(commentText); }}
              placeholder={`Scrie un mesaj ca ${selectedHostName}…`}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
            />
            <button
              onClick={() => sendComment(commentText)}
              disabled={!commentText.trim() || sendingComment}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-sm font-medium rounded-lg transition-colors"
            >
              Trimite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const REFERRAL_WHATSAPP_MESSAGE =
  'Salut! Vreau să-ți recomand AncaVisuals pentru foto/video la evenimente — au făcut treabă superbă și la evenimentul nostru. https://ancavisuals.ro';

function ReferralBanner() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-5 py-5 space-y-4">
      <div>
        <p className="text-white text-sm font-medium">Recomandă-ne mai departe</p>
        <p className="text-neutral-500 text-xs mt-1">
          Dacă vrei să recomanzi serviciile foto video, ne poți recomanda cuiva prin WhatsApp.
        </p>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(REFERRAL_WHATSAPP_MESSAGE)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.561 4.14 1.535 5.874L.057 23.943l6.235-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.369l-.36-.214-3.7.97.988-3.608-.234-.372A9.818 9.818 0 0112 2.182c5.424 0 9.818 4.394 9.818 9.818 0 5.425-4.394 9.818-9.818 9.818z" />
        </svg>
        Recomandă pe WhatsApp
      </a>
    </div>
  );
}

export default function QRMomentsGalleryPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const { auth } = useAuth();

  const [pin, setPin] = useState(() => {
    if (typeof window === 'undefined') return '';
    const linkPin = new URLSearchParams(window.location.search).get('pin');
    return (linkPin || sessionStorage.getItem(`qr-gallery-pin-${eventSlug}`) || '').toUpperCase();
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [eventInfo, setEventInfo] = useState<GalleryEventInfo | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [thankTarget, setThankTarget] = useState<Upload | null>(null);

  const allUploads = groups.flatMap((group) => group.uploads);

  const loadGallery = async (pinValue: string, adminToken?: string) => {
    setGalleryLoading(true);
    try {
      const url = adminToken
        ? `/api/qr-moments/${eventSlug}/gallery`
        : `/api/qr-moments/${eventSlug}/gallery?pin=${encodeURIComponent(pinValue)}`;
      const headers: Record<string, string> = {};
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const result = await fetch(url, { headers }).then((r) => r.json());
      if (result.error) { setPinError('PIN incorect.'); return false; }
      setGroups(result.groups ?? []);
      setQuickReplies(result.quickReplies ?? []);
      setEventInfo(result.event ?? null);
      return true;
    } catch {
      setPinError('Eroare de rețea.');
      return false;
    } finally {
      setGalleryLoading(false);
    }
  };

  // Admin flow: bypass the PIN entirely.
  useEffect(() => {
    if (auth.authorise && auth.accessToken) {
      loadGallery('', auth.accessToken).then((success) => { if (success) setAuthenticated(true); });
    }
  }, [auth.authorise, auth.accessToken]);

  // Non-admin flow: restore the PIN from session storage.
  useEffect(() => {
    if (!auth.authorise && pin) {
      loadGallery(pin).then((success) => { if (success) setAuthenticated(true); else setPin(''); });
    }
  }, []);

  const handlePinSubmit = async () => {
    if (!pinInput.trim()) return;
    setPinLoading(true);
    setPinError('');
    const success = await loadGallery(pinInput.trim().toUpperCase());
    if (success) {
      sessionStorage.setItem(`qr-gallery-pin-${eventSlug}`, pinInput.trim().toUpperCase());
      setPin(pinInput.trim().toUpperCase());
      setAuthenticated(true);
    }
    setPinLoading(false);
  };

  const handleThanked = (uploadId: string, thankedAt: string) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        uploads: group.uploads.map((upload) =>
          upload.id === uploadId ? { ...upload, thankedAt } : upload
        ),
      }))
    );
  };

  if (!authenticated) {
    if (auth.loading || (auth.authorise && galleryLoading)) {
      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <svg className="animate-spin text-neutral-600" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="w-full max-w-xs space-y-5">
          <div className="text-center space-y-1">
            <div className="text-3xl mb-3">🔐</div>
            <h1 className="text-white text-xl font-light">Galerie QR Moments</h1>
            <p className="text-neutral-500 text-sm">Introdu PIN-ul primit de la AncaVisuals</p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => { if (event.key === 'Enter') handlePinSubmit(); }}
              placeholder="ex: AB12CD"
              maxLength={8}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-3 text-white text-center text-lg tracking-widest placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
            />
            {pinError && <p className="text-red-400 text-xs text-center">{pinError}</p>}
            <button
              onClick={handlePinSubmit}
              disabled={!pinInput.trim() || pinLoading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-medium rounded-xl text-sm transition-colors"
            >
              {pinLoading ? 'Se verifică…' : 'Intră în galerie'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalUploads = groups.reduce((sum, group) => sum + group.uploads.length, 0);

  return (
    <>
      {selectedUpload && (
        <AssetModal
          upload={selectedUpload}
          allUploads={allUploads}
          eventSlug={eventSlug ?? ''}
          pin={pin}
          adminToken={auth.authorise ? auth.accessToken : undefined}
          hasAdminBar={auth.authorise}
          quickReplies={quickReplies}
          eventInfo={eventInfo}
          onNavigate={setSelectedUpload}
          onClose={() => setSelectedUpload(null)}
        />
      )}

      {thankTarget && (
        <ThankModal
          upload={thankTarget}
          eventSlug={eventSlug ?? ''}
          pin={pin}
          adminToken={auth.authorise ? auth.accessToken : undefined}
          eventInfo={eventInfo}
          onClose={() => setThankTarget(null)}
          onThanked={handleThanked}
        />
      )}

      <div className="min-h-screen bg-neutral-950 px-4 py-10">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-xl font-light">QR Moments</h1>
              <p className="text-neutral-500 text-xs mt-0.5">{eventSlug} · {totalUploads} fișiere de la {groups.length} invitați</p>
            </div>
            <button
              onClick={() => auth.authorise && auth.accessToken ? loadGallery('', auth.accessToken) : loadGallery(pin)}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 text-xs hover:border-neutral-500 hover:text-white transition-colors"
            >
              Reîncarcă
            </button>
          </div>

          <GalleryUpdatesSignup eventSlug={eventSlug ?? ''} pin={pin} hidden={auth.authorise} />

          {galleryLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin text-neutral-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500 text-sm">Nicio poză/video/mesaj încă.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <div key={group.guest.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-medium">
                      {group.guest.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-neutral-300 text-sm font-medium">{group.guest.name}</p>
                      <p className="text-neutral-600 text-xs">
                        {group.uploads.length} {group.uploads.length === 1 ? 'fișier' : 'fișiere'} ·{' '}
                        {formatTime(group.uploads[0].createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.uploads.map((upload) => (
                      <div key={upload.id} className="relative">
                        <MediaThumbnail upload={upload} onClick={() => setSelectedUpload(upload)} />
                        {group.guest.hasEmail && (
                          <button
                            onClick={() => setThankTarget(upload)}
                            disabled={!!upload.thankedAt}
                            title={upload.thankedAt ? 'Mulțumire trimisă' : 'Mulțumește invitatul'}
                            className={`absolute bottom-1 right-1 w-6 h-6 rounded-full text-[11px] flex items-center justify-center transition-all shadow-sm ${
                              upload.thankedAt
                                ? 'bg-amber-500 text-black cursor-default'
                                : 'bg-black/70 text-white hover:bg-amber-500 hover:text-black'
                            }`}
                          >
                            {upload.thankedAt ? '✓' : '✉'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-neutral-800">
                <ReferralBanner />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
