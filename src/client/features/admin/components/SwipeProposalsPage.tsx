import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

interface Proposal {
  id: string;
  albumSlug: string;
  photoUrl: string;
  fileName: string;
  status: string;
}

const SWIPE_THRESHOLD  = 90;
const ROTATION_FACTOR  = 0.06;
const FLY_OUT_DISTANCE = 900;
const QUEUE_SIZE       = 4;
const MAX_UNDO         = 7;

const STACK_SCALE   = [1,    0.95, 0.90, 0.85];
const STACK_Y       = [0,    12,   22,   30  ];
const STACK_OPACITY = [1,    0.1,  0.1,  0.1 ];

export default function SwipeProposalsPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [proposals, setProposals]           = useState<Proposal[]>([]);
  const [currentIndex, setCurrentIndex]     = useState(0);
  const [maxIndexReached, setMaxIndexReached] = useState(0);
  const [decisions, setDecisions]           = useState<Record<string, "accepted" | "rejected">>({});
  const [dragX, setDragX]                   = useState(0);
  const [isDragging, setIsDragging]         = useState(false);
  const [exitDirection, setExitDirection]   = useState<"left" | "right" | null>(null);
  const [loading, setLoading]               = useState(true);
  const [resultTab, setResultTab]           = useState<"accepted" | "rejected">("accepted");

  // Refs — never stale inside callbacks
  const isDraggingRef      = useRef(false);
  const dragXRef           = useRef(0);
  const dragStartXRef      = useRef(0);
  const exitDirectionRef   = useRef<"left" | "right" | null>(null);
  const currentIndexRef    = useRef(0);
  const maxIndexReachedRef = useRef(0);
  const proposalsRef       = useRef<Proposal[]>([]);
  const accessTokenRef     = useRef(auth.accessToken);

  useEffect(() => { accessTokenRef.current = auth.accessToken; }, [auth.accessToken]);
  useEffect(() => { proposalsRef.current = proposals; }, [proposals]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { maxIndexReachedRef.current = maxIndexReached; }, [maxIndexReached]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  useEffect(() => {
    fetch("/api/instagram-proposals/admin/all", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((r) => r.json())
      .then((data: { proposals?: Proposal[] }) => {
        setProposals((data.proposals ?? []).filter((p) => p.status === "pending"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  const advance = useCallback((direction: "left" | "right") => {
    if (exitDirectionRef.current) return;
    const proposal = proposalsRef.current[currentIndexRef.current];
    if (!proposal) return;

    exitDirectionRef.current = direction;
    setExitDirection(direction);

    const status = direction === "right" ? "accepted" : "rejected";
    setDecisions((prev) => ({ ...prev, [proposal.id]: status }));

    fetch(`/api/instagram-proposals/${proposal.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessTokenRef.current}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }).catch(() => {});

    setTimeout(() => {
      const newIndex = currentIndexRef.current + 1;
      currentIndexRef.current = newIndex;
      setCurrentIndex(newIndex);
      setMaxIndexReached((prev) => Math.max(prev, newIndex));
      setDragX(0);
      dragXRef.current = 0;
      exitDirectionRef.current = null;
      setExitDirection(null);
    }, 420);
  }, []);

  const goBack = useCallback(() => {
    if (currentIndexRef.current <= 0) return;
    if (maxIndexReachedRef.current - currentIndexRef.current >= MAX_UNDO) return;
    exitDirectionRef.current = null;
    setExitDirection(null);
    const newIndex = currentIndexRef.current - 1;
    currentIndexRef.current = newIndex;
    setCurrentIndex(newIndex);
    setDragX(0);
    dragXRef.current = 0;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (exitDirectionRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragXRef.current = 0;
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const newX = e.clientX - dragStartXRef.current;
    dragXRef.current = newX;
    setDragX(newX);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const finalX = dragXRef.current;
    dragXRef.current = 0;
    if (finalX > SWIPE_THRESHOLD)       advance("right");
    else if (finalX < -SWIPE_THRESHOLD) advance("left");
    else setDragX(0);
  }, [advance]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance("right");
      if (e.key === "ArrowLeft")  advance("left");
      if (e.key === "ArrowUp" || e.key === "Backspace") goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [advance, goBack]);

  const current      = proposals[currentIndex];
  const prevDecision = decisions[current?.id ?? ""];
  const canGoBack    = currentIndex > 0 && (maxIndexReached - currentIndex) < MAX_UNDO;
  const isDone       = !loading && currentIndex >= proposals.length;
  const intensity    = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const goingRight   = dragX > 0;
  const goingLeft    = dragX < 0;

  // Base rotation from previous decision (subtle tilt as hint)
  const baseRotation = prevDecision === "accepted" ? 3 : prevDecision === "rejected" ? -3 : 0;

  let activeTranslateX = dragX;
  let activeTranslateY = Math.abs(dragX) * 0.04;
  let activeRotation   = dragX * ROTATION_FACTOR + baseRotation;
  let activeOpacity    = 1;

  if (exitDirection === "right") {
    activeTranslateX = FLY_OUT_DISTANCE;
    activeTranslateY = -60;
    activeRotation   = 22;
    activeOpacity    = 0;
  } else if (exitDirection === "left") {
    activeTranslateX = -FLY_OUT_DISTANCE;
    activeTranslateY = -60;
    activeRotation   = -22;
    activeOpacity    = 0;
  }

  const acceptedList = proposals.filter((p) => decisions[p.id] === "accepted");
  const rejectedList = proposals.filter((p) => decisions[p.id] === "rejected");

  // ── Done ──────────────────────────────────────────────────────────────────
  if (isDone) {
    const list = resultTab === "accepted" ? acceptedList : rejectedList;
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center py-10 px-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Sesiune completă</h1>
            <p className="text-neutral-400 text-sm">
              {acceptedList.length} acceptate · {rejectedList.length} respinse
            </p>
          </div>

          <button
            onClick={() => navigate("/admin/instagram-proposals")}
            className="mx-auto mb-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm font-medium hover:bg-neutral-700 hover:text-white transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Înapoi la Propuneri
          </button>

          {acceptedList.length + rejectedList.length === 0 && (
            <p className="text-center text-neutral-600 mt-16">Nicio propunere pending găsită.</p>
          )}

          {acceptedList.length + rejectedList.length > 0 && (
            <>
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1 mb-6">
                {(["accepted", "rejected"] as const).map((tab) => {
                  const count = tab === "accepted" ? acceptedList.length : rejectedList.length;
                  const active = resultTab === tab;
                  return (
                    <button key={tab} onClick={() => setResultTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? tab === "accepted" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        tab === "accepted" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>{count}</span>
                      {tab === "accepted" ? "Acceptate" : "Respinse"}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {list.map((proposal) => (
                  <div key={proposal.id} className="aspect-square rounded-lg overflow-hidden relative group">
                    <img src={proposal.photoUrl} alt={proposal.fileName} className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 ${
                      resultTab === "accepted" ? "bg-gradient-to-t from-emerald-900/80 to-transparent" : "bg-gradient-to-t from-red-900/80 to-transparent"
                    }`}>
                      <p className="text-white text-[10px] truncate">{proposal.fileName}</p>
                    </div>
                    <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      resultTab === "accepted" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    }`}>{resultTab === "accepted" ? "✓" : "✕"}</div>
                  </div>
                ))}
              </div>
              {list.length === 0 && (
                <p className="text-center text-neutral-600 mt-12 text-sm">
                  Nicio poză {resultTab === "accepted" ? "acceptată" : "respinsă"}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin text-neutral-600" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-neutral-500 text-sm">Se încarcă propunerile...</p>
        </div>
      </div>
    );
  }

  // ── Swipe UI ──────────────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-neutral-950 flex flex-col items-center justify-between py-6 px-4 select-none overflow-hidden" style={{ touchAction: 'none' }}>

      {/* Header */}
      <div className="w-full max-w-sm flex items-center gap-3">
        {/* Progress bar */}
        <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-neutral-600 rounded-full transition-all duration-300"
            style={{ width: `${proposals.length > 0 ? (currentIndex / proposals.length) * 100 : 0}%` }}
          />
        </div>

        {/* Score */}
        <div className="shrink-0 flex items-center gap-3">
          <span className="text-xs font-medium text-emerald-500">✓ {acceptedList.length}</span>
          <span className="text-xs font-medium text-red-500">✕ {rejectedList.length}</span>
        </div>
      </div>

      {/* Card stack */}
      <div className="w-full max-w-sm flex-1 flex items-center justify-center py-4 relative overflow-visible">
        {Array.from({ length: QUEUE_SIZE }).map((_, offset) => {
          const queueIndex = QUEUE_SIZE - 1 - offset;
          const proposal   = proposals[currentIndex + queueIndex];
          if (!proposal) return null;

          const isActive = queueIndex === 0;
          const isNext   = queueIndex === 1;
          const qDec     = decisions[proposal.id];

          let scale      = exitDirection ? STACK_SCALE[Math.max(0, queueIndex - 1)]   : STACK_SCALE[queueIndex];
          let translateY = exitDirection ? STACK_Y[Math.max(0, queueIndex - 1)]       : STACK_Y[queueIndex];
          let opacity    = exitDirection ? STACK_OPACITY[Math.max(0, queueIndex - 1)] : STACK_OPACITY[queueIndex];
          let translateX = 0;
          let rotation   = 0;

          if (isNext && !exitDirection) {
            opacity = 0.1 + intensity * 0.4;
          }

          if (isActive) {
            translateX = activeTranslateX;
            translateY = activeTranslateY;
            rotation   = activeRotation;
            opacity    = activeOpacity;
            scale      = 1;
          } else if (!isActive && !exitDirection && qDec) {
            // Decided cards in the queue: tilt to hint at their decision
            rotation = qDec === "accepted" ? 2 : -2;
            translateX = qDec === "accepted" ? 6 : -6;
          }

          return (
            <div
              key={proposal.id}
              onPointerDown={isActive ? onPointerDown : undefined}
              onPointerMove={isActive ? onPointerMove : undefined}
              onPointerUp={isActive ? onPointerUp : undefined}
              onPointerCancel={isActive ? onPointerUp : undefined}
              style={{
                position: "absolute",
                width: "100%",
                background: "#0a0a0a",
                borderRadius: 0,
                overflow: "hidden",
                boxShadow: isActive ? "0 0 0 60px #0a0a0a, 0 0 80px 60px #0a0a0a" : "none",
                zIndex: QUEUE_SIZE - queueIndex,
                transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`,
                opacity,
                transition: isActive && isDragging
                  ? "none"
                  : "transform 0.42s cubic-bezier(0.45,0,0.55,1), opacity 0.42s cubic-bezier(0.45,0,0.55,1)",
                cursor: isActive ? (isDragging ? "grabbing" : "grab") : "default",
                userSelect: "none",
                touchAction: isActive ? "none" : "auto",
              }}
            >
              <img
                src={proposal.photoUrl}
                alt={proposal.fileName}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "68vh",
                  objectFit: "contain",
                  pointerEvents: "none",
                }}
                draggable={false}
              />

              {isActive && (
                <>
                  {/* Red overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(135deg,rgba(239,68,68,0.7),rgba(239,68,68,0.25))",
                    opacity: goingLeft ? intensity : 0,
                    transition: isDragging ? "none" : "opacity 0.15s",
                    pointerEvents: "none",
                  }} />
                  {/* Green overlay */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(225deg,rgba(34,197,94,0.7),rgba(34,197,94,0.25))",
                    opacity: goingRight ? intensity : 0,
                    transition: isDragging ? "none" : "opacity 0.15s",
                    pointerEvents: "none",
                  }} />

                  {/* Previous-decision hint stamp (always faintly visible) */}
                  {prevDecision === "rejected" && (
                    <div style={{ position: "absolute", top: 20, left: 20, pointerEvents: "none", transform: "rotate(-18deg)" }}>
                      <div style={{ border: "3px solid #ef4444", borderRadius: 6, padding: "3px 10px", color: "#ef4444", fontWeight: 800, fontSize: 20, letterSpacing: 3, lineHeight: 1, opacity: goingRight ? 0 : Math.max(0.2, 1 - intensity) }}>REJECT</div>
                    </div>
                  )}
                  {prevDecision === "accepted" && (
                    <div style={{ position: "absolute", top: 20, right: 20, pointerEvents: "none", transform: "rotate(18deg)" }}>
                      <div style={{ border: "3px solid #22c55e", borderRadius: 6, padding: "3px 10px", color: "#22c55e", fontWeight: 800, fontSize: 20, letterSpacing: 3, lineHeight: 1, opacity: goingLeft ? 0 : Math.max(0.2, 1 - intensity) }}>ACCEPT</div>
                    </div>
                  )}

                  {/* Drag stamps */}
                  <div style={{ position: "absolute", top: 20, left: 20, opacity: goingLeft ? intensity : 0, transition: isDragging ? "none" : "opacity 0.12s", pointerEvents: "none", transform: "rotate(-18deg)" }}>
                    <div style={{ border: "3px solid #ef4444", borderRadius: 6, padding: "3px 10px", color: "#ef4444", fontWeight: 800, fontSize: 22, letterSpacing: 3, lineHeight: 1 }}>REJECT</div>
                  </div>
                  <div style={{ position: "absolute", top: 20, right: 20, opacity: goingRight ? intensity : 0, transition: isDragging ? "none" : "opacity 0.12s", pointerEvents: "none", transform: "rotate(18deg)" }}>
                    <div style={{ border: "3px solid #22c55e", borderRadius: 6, padding: "3px 10px", color: "#22c55e", fontWeight: 800, fontSize: 22, letterSpacing: 3, lineHeight: 1 }}>ACCEPT</div>
                  </div>
                </>
              )}

              {/* Badge on queue cards that are already decided */}
              {!isActive && qDec && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  width: 20, height: 20, borderRadius: "50%",
                  background: qDec === "accepted" ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff",
                }}>
                  {qDec === "accepted" ? "✓" : "✕"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Album info + buttons */}
      {current && (
        <div className="w-full max-w-sm text-center mb-3">
          <p className="text-white text-sm font-medium">{current.albumSlug}</p>
          <p className="text-neutral-500 text-xs mt-0.5">{currentIndex + 1} / {proposals.length} · {current.fileName}</p>
        </div>
      )}

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-6 mb-3">
          {/* Rewind — la stânga, mai mic */}
          <button
            onClick={goBack}
            disabled={!canGoBack}
            title="Înapoi un pas"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-500 hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
            </svg>
          </button>

          <button onClick={() => advance("left")} disabled={!!exitDirection || !current}
            className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/25 hover:border-red-500/70 active:scale-95 transition-all text-2xl disabled:opacity-30"
          >✕</button>

          <button onClick={() => advance("right")} disabled={!!exitDirection || !current}
            className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/70 active:scale-95 transition-all text-2xl disabled:opacity-30"
          >✓</button>
        </div>
        <p className="text-center text-neutral-700 text-xs">← → · ↑ / Backspace = rewind</p>
      </div>
    </div>
  );
}
