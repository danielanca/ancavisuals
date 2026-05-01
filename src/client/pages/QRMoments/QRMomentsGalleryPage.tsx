import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import useAuth from '../../features/admin/auth/useAuth';

interface Upload {
  id: string;
  type: 'photo' | 'video' | 'audio';
  bunnyUrl: string;
  mimeType: string;
  originalName: string;
  createdAt: string;
}

interface GuestGroup {
  guest: { id: string; name: string };
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
}

const DISPLAYABLE_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const DISPLAYABLE_VIDEO = ['video/mp4'];
const DISPLAYABLE_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];

const QUICK_REPLIES_FALLBACK = [
  'Mulțumim pentru mesaj! Vă iubim',
  'Îți mulțumim din suflet!',
  'Ce surpriză minunată, mulțumim!',
  'Mulțumim, înseamnă enorm pentru noi!',
];

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function MediaThumbnail({ upload, onClick }: { upload: Upload; onClick: () => void }) {
  if (DISPLAYABLE_IMAGE.includes(upload.mimeType)) {
    return (
      <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg overflow-hidden bg-neutral-800 hover:opacity-80 transition-opacity w-full">
        <img src={upload.bunnyUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      </button>
    );
  }
  if (DISPLAYABLE_VIDEO.includes(upload.mimeType)) {
    return (
      <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg overflow-hidden bg-neutral-800 relative hover:opacity-80 transition-opacity w-full">
        <video src={upload.bunnyUrl} className="w-full h-full object-cover" muted />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white text-xs">▶</div>
        </div>
      </button>
    );
  }
  if (DISPLAYABLE_AUDIO.includes(upload.mimeType)) {
    return (
      <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg bg-neutral-800 flex flex-col items-center justify-center gap-2 hover:bg-neutral-700 transition-colors w-full">
        <span className="text-2xl">🎙</span>
        <span className="text-neutral-500 text-xs">Mesaj vocal</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} aria-label={`Deschide ${upload.originalName}`} className="aspect-square rounded-lg bg-neutral-800 flex flex-col items-center justify-center gap-2 hover:bg-neutral-700 transition-colors w-full">
      <span className="text-2xl">📎</span>
      <span className="text-neutral-500 text-xs truncate max-w-full px-2">{upload.originalName}</span>
    </button>
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
  const selectedHostName = hostRole === 'groom'
    ? (eventInfo?.groom?.trim() || 'Mirele')
    : (eventInfo?.bride?.trim() || 'Mireasa');
  const currentIndex = allUploads.findIndex((item) => item.id === upload.id);
  const previousUpload = currentIndex > 0 ? allUploads[currentIndex - 1] : null;
  const nextUpload = currentIndex >= 0 && currentIndex < allUploads.length - 1 ? allUploads[currentIndex + 1] : null;

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
        className={`flex-1 flex flex-col max-w-lg mx-auto w-full ${hasAdminBar ? 'pt-12' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => previousUpload && onNavigate(previousUpload)}
              disabled={!previousUpload}
              className="mt-2 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-30"
              aria-label="Upload anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => nextUpload && onNavigate(nextUpload)}
              disabled={!nextUpload}
              className="mt-2 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-30"
              aria-label="Upload următor"
            >
              ›
            </button>
            <p className="mt-2 text-neutral-400 text-xs">{formatTime(upload.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {DISPLAYABLE_IMAGE.includes(upload.mimeType) && (
              <img src={upload.bunnyUrl} alt="" className="w-full rounded-lg" />
            )}
            {DISPLAYABLE_VIDEO.includes(upload.mimeType) && (
              <video src={upload.bunnyUrl} controls className="w-full rounded-lg" />
            )}
            {DISPLAYABLE_AUDIO.includes(upload.mimeType) && (
              <div className="bg-neutral-900 rounded-lg p-4">
                <audio src={upload.bunnyUrl} controls className="w-full" />
              </div>
            )}
            {!DISPLAYABLE_IMAGE.includes(upload.mimeType) && !DISPLAYABLE_VIDEO.includes(upload.mimeType) && !DISPLAYABLE_AUDIO.includes(upload.mimeType) && (
              <a
                href={upload.bunnyUrl}
                download={upload.originalName}
                className="block w-full py-3 bg-neutral-800 rounded-lg text-neutral-300 text-sm text-center hover:bg-neutral-700 transition-colors"
              >
                Descarcă fișierul
              </a>
            )}
          </div>

          <div className="px-4 pb-4">
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
                            ? (eventInfo?.groom?.trim() || 'Mirele')
                            : (eventInfo?.bride?.trim() || 'Mireasa')}
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

        <div className="border-t border-neutral-800 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">Trimite ca</span>
            <div className="inline-flex rounded-full border border-neutral-800 bg-neutral-900 p-1">
              {([
                { value: 'bride', label: eventInfo?.bride?.trim() || 'Mireasa' },
                { value: 'groom', label: eventInfo?.groom?.trim() || 'Mirele' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setHostRole(option.value)}
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

export default function QRMomentsGalleryPage() {
  const { eventSlug } = useParams<{ eventSlug: string }>();
  const { auth } = useAuth();

  const [pin, setPin] = useState(() => sessionStorage.getItem(`qr-gallery-pin-${eventSlug}`) ?? '');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [eventInfo, setEventInfo] = useState<GalleryEventInfo | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
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

  if (!authenticated) {
    // While auth is loading, or while the admin auto-login path is loading the gallery, show a spinner.
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
                      <MediaThumbnail key={upload.id} upload={upload} onClick={() => setSelectedUpload(upload)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
