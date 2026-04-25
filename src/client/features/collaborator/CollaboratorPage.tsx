import React, { useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase";
import useAuth from "../admin/auth/useAuth";
import AncaLoader from "../../components/UI/AncaLoader";

const PRESET_TAGS = [
  "nuntă", "botez", "cununia civilă", "logodnă", "cununie",
  "biserică", "altar", "restaurant", "sală", "curte", "grădină", "parc",
  "exterior", "interior", "natură", "terrasă", "mansardă", "plajă",
  "mire", "mireasă", "mire+mireasă", "nași", "nașă", "nas",
  "socri", "părinți", "bunici", "tineri-căsătoriți",
  "bebeluș", "nași-botez", "cristelniță",
  "grup", "copii", "portret", "familie", "invitați",
  "ceremonie", "primul-dans", "vals", "hora", "primul-sărut",
  "schimb-inele", "tort", "buchet-aruncat", "discurs", "felicitări",
  "intrare", "ieșire", "petrecere", "jocul-mirilor",
  "fum-artificial", "confetti", "foc-artificii", "aplauze",
  "lumânare", "botezul-propriu-zis", "masa-botez",
  "sesiune-foto", "after-session",
  "detalii", "buchet", "verighete", "rochie", "voal", "costum",
  "pantofi", "aranjament-floral", "invitație", "tort-nuntă", "tort-botez",
  "lumânare-nuntă", "coronița", "candy-bar", "decorațiuni", "flori", "baloane",
  "emoție", "lacrimi", "zâmbet", "râs", "romantic", "vesel", "intim",
  "golden-hour", "lumină-naturală", "lumina-ferestrei", "backlight",
  "seară", "lumini", "dramatic", "moody",
  "candid", "editorial", "fine-art", "alb-negru", "silhouetă",
  "close-up", "wide-angle", "reflecție",
  "decor", "machiaj", "dans",
];

interface InspirationPhoto {
  id: string;
  url: string;
  tags: string[];
  notes?: string;
}

interface Proposal {
  id: string;
  url: string;
  tags: string[];
  notes: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string;
  proposedAt: string;
}

interface PhotoDraft {
  file: File;
  preview: string;
  tags: string[];
  notes: string;
  aiLoading: boolean;
  progress: number | null;
}

type Tab = "gallery" | "propose";

interface State {
  tab: Tab;
  galleryPhotos: InspirationPhoto[];
  galleryLoading: boolean;
  proposals: Proposal[];
  proposalsLoading: boolean;
  drafts: PhotoDraft[];
  draftIndex: number;
  customTag: string;
  submitting: boolean;
  submitError: string;
  submitSuccess: boolean;
}

type Action =
  | { type: "SET_TAB"; tab: Tab }
  | { type: "SET_GALLERY"; photos: InspirationPhoto[] }
  | { type: "SET_GALLERY_LOADING"; loading: boolean }
  | { type: "SET_PROPOSALS"; proposals: Proposal[] }
  | { type: "SET_PROPOSALS_LOADING"; loading: boolean }
  | { type: "ADD_DRAFTS"; drafts: PhotoDraft[] }
  | { type: "REMOVE_DRAFT"; index: number }
  | { type: "SET_DRAFT_INDEX"; index: number }
  | { type: "UPDATE_DRAFT"; index: number; updates: Partial<PhotoDraft> }
  | { type: "SET_CUSTOM_TAG"; value: string }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_SUBMIT_ERROR"; error: string }
  | { type: "SET_SUBMIT_SUCCESS"; value: boolean }
  | { type: "CLEAR_DRAFTS" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, tab: action.tab, submitSuccess: false, submitError: "" };
    case "SET_GALLERY":
      return { ...state, galleryPhotos: action.photos };
    case "SET_GALLERY_LOADING":
      return { ...state, galleryLoading: action.loading };
    case "SET_PROPOSALS":
      return { ...state, proposals: action.proposals };
    case "SET_PROPOSALS_LOADING":
      return { ...state, proposalsLoading: action.loading };
    case "ADD_DRAFTS": {
      const total = state.drafts.length + action.drafts.length;
      const allowed = action.drafts.slice(0, 6 - state.drafts.length);
      const newDrafts = [...state.drafts, ...allowed];
      return {
        ...state,
        drafts: newDrafts,
        draftIndex: state.drafts.length === 0 ? 0 : state.draftIndex,
        submitError: total > 6 ? "Poți propune maxim 6 poze deodată." : "",
      };
    }
    case "REMOVE_DRAFT": {
      const next = state.drafts.filter((_, i) => i !== action.index);
      return {
        ...state,
        drafts: next,
        draftIndex: Math.min(state.draftIndex, Math.max(0, next.length - 1)),
      };
    }
    case "SET_DRAFT_INDEX":
      return { ...state, draftIndex: action.index };
    case "UPDATE_DRAFT":
      return {
        ...state,
        drafts: state.drafts.map((draft, i) =>
          i === action.index ? { ...draft, ...action.updates } : draft
        ),
      };
    case "SET_CUSTOM_TAG":
      return { ...state, customTag: action.value };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.value };
    case "SET_SUBMIT_ERROR":
      return { ...state, submitError: action.error };
    case "SET_SUBMIT_SUCCESS":
      return { ...state, submitSuccess: action.value };
    case "CLEAR_DRAFTS":
      return { ...state, drafts: [], draftIndex: 0, customTag: "", submitSuccess: true };
    default:
      return state;
  }
}

const initialState: State = {
  tab: "propose",
  galleryPhotos: [],
  galleryLoading: false,
  proposals: [],
  proposalsLoading: false,
  drafts: [],
  draftIndex: 0,
  customTag: "",
  submitting: false,
  submitError: "",
  submitSuccess: false,
};

function TagPill({ tag, selected, onClick }: { tag: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        selected
          ? "bg-violet-500 text-white"
          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
      }`}
    >
      {tag}
    </button>
  );
}

function StatusBadge({ status }: { status: Proposal["status"] }) {
  if (status === "pending") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
        În așteptare
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
        ✓ Acceptat
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
      Respins
    </span>
  );
}

export default function CollaboratorPage() {
  const { auth, logOut } = useAuth();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);

  const currentDraft = state.drafts[state.draftIndex] ?? null;

  useEffect(() => {
    if (!auth.accessToken) return;
    dispatch({ type: "SET_PROPOSALS_LOADING", loading: true });
    fetch("/api/inspiration-proposals/my", {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then((response) => response.json())
      .then((data: { proposals?: Proposal[] }) => {
        dispatch({ type: "SET_PROPOSALS", proposals: data.proposals ?? [] });
      })
      .finally(() => dispatch({ type: "SET_PROPOSALS_LOADING", loading: false }));
  }, [auth.accessToken]);

  useEffect(() => {
    if (state.tab !== "gallery") return;
    if (state.galleryPhotos.length > 0) return;
    dispatch({ type: "SET_GALLERY_LOADING", loading: true });
    fetch("/api/admin/inspiration/photos")
      .then((response) => response.json())
      .then((data: { photos?: InspirationPhoto[] }) => {
        dispatch({ type: "SET_GALLERY", photos: data.photos ?? [] });
      })
      .finally(() => dispatch({ type: "SET_GALLERY_LOADING", loading: false }));
  }, [state.tab, state.galleryPhotos.length]);

  const handlePickFiles = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const newDrafts: PhotoDraft[] = imageFiles.slice(0, 6 - state.drafts.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      tags: [],
      notes: "",
      aiLoading: false,
      progress: null,
    }));
    dispatch({ type: "ADD_DRAFTS", drafts: newDrafts });
    if (inputRef.current) inputRef.current.value = "";
  };

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const suggestAI = async (index: number) => {
    const draft = state.drafts[index];
    if (!draft) return;
    dispatch({ type: "UPDATE_DRAFT", index, updates: { aiLoading: true } });
    try {
      const base64 = await getBase64(draft.file);
      const response = await fetch("/api/admin/inspiration/suggest-tags-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: draft.file.type || "image/jpeg",
          availableTags: PRESET_TAGS,
        }),
      });
      const data = await response.json();
      const newTags: string[] = data.tags ?? [];
      dispatch({
        type: "UPDATE_DRAFT",
        index,
        updates: {
          tags: Array.from(new Set([...draft.tags, ...newTags])),
          aiLoading: false,
        },
      });
    } catch {
      dispatch({ type: "UPDATE_DRAFT", index, updates: { aiLoading: false } });
    }
  };

  const toggleTag = (tag: string) => {
    if (!currentDraft) return;
    const updated = currentDraft.tags.includes(tag)
      ? currentDraft.tags.filter((tagItem) => tagItem !== tag)
      : [...currentDraft.tags, tag];
    dispatch({ type: "UPDATE_DRAFT", index: state.draftIndex, updates: { tags: updated } });
  };

  const addCustomTag = () => {
    if (!currentDraft) return;
    const newTags = state.customTag
      .split(/[,;]+/)
      .map((tagItem) => tagItem.trim().toLowerCase())
      .filter((tagItem) => tagItem.length > 0 && !currentDraft.tags.includes(tagItem));
    if (newTags.length > 0) {
      dispatch({
        type: "UPDATE_DRAFT",
        index: state.draftIndex,
        updates: { tags: [...currentDraft.tags, ...newTags] },
      });
    }
    dispatch({ type: "SET_CUSTOM_TAG", value: "" });
  };

  const uploadDraft = (draft: PhotoDraft, index: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const uid = auth.user?.uid ?? "unknown";
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${draft.file.name.replace(/\s+/g, "_")}`;
      const fileRef = storageRef(storage, `inspiration-proposals/${uid}/${safeName}`);
      const task = uploadBytesResumable(fileRef, draft.file);
      task.on(
        "state_changed",
        (snap) => {
          const percent = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          dispatch({ type: "UPDATE_DRAFT", index, updates: { progress: percent } });
        },
        reject,
        async () => {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve(downloadUrl);
        },
      );
    });

  const handleSubmit = async () => {
    if (state.drafts.length === 0) return;
    dispatch({ type: "SET_SUBMIT_ERROR", error: "" });
    dispatch({ type: "SET_SUBMITTING", value: true });

    try {
      const uploadedUrls = await Promise.all(
        state.drafts.map((draft, index) => uploadDraft(draft, index))
      );

      const photos = state.drafts.map((draft, index) => ({
        url: uploadedUrls[index],
        tags: draft.tags,
        notes: draft.notes,
      }));

      const response = await fetch("/api/inspiration-proposals/propose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ photos }),
      });

      const data = await response.json();
      if (!response.ok) {
        dispatch({ type: "SET_SUBMIT_ERROR", error: data.error ?? "Eroare la trimitere." });
        return;
      }

      dispatch({ type: "CLEAR_DRAFTS" });

      const proposalsResponse = await fetch("/api/inspiration-proposals/my", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const proposalsData = await proposalsResponse.json();
      dispatch({ type: "SET_PROPOSALS", proposals: proposalsData.proposals ?? [] });
    } catch (error) {
      dispatch({ type: "SET_SUBMIT_ERROR", error: String(error) });
    } finally {
      dispatch({ type: "SET_SUBMITTING", value: false });
    }
  };

  const handleLogout = async () => {
    await logOut();
    navigate("/login", { replace: true });
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && state.draftIndex < state.drafts.length - 1) {
        dispatch({ type: "SET_DRAFT_INDEX", index: state.draftIndex + 1 });
      } else if (delta > 0 && state.draftIndex > 0) {
        dispatch({ type: "SET_DRAFT_INDEX", index: state.draftIndex - 1 });
      }
    }
    touchStartX.current = null;
  };

  const pendingCount = state.proposals.filter((proposal) => proposal.status === "pending").length;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-xl font-light tracking-tight">
              <span style={{ fontWeight: 700 }}>Anca</span>
              <span style={{ fontWeight: 300, color: "#d1d5db" }}>Visuals</span>
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">{auth.user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-400 text-xs hover:border-red-500/50 hover:text-red-400 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Deconectare
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          <button
            onClick={() => dispatch({ type: "SET_TAB", tab: "propose" })}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              state.tab === "propose"
                ? "bg-violet-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Propune Poze
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-400 text-xs">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => dispatch({ type: "SET_TAB", tab: "gallery" })}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              state.tab === "gallery"
                ? "bg-violet-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Galerie Inspirație
          </button>
        </div>

        {/* ── TAB: Propune Poze ────────────────────────────────── */}
        {state.tab === "propose" && (
          <div className="space-y-5">

            {state.submitSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                <p className="text-emerald-400 text-sm font-medium">✓ Pozele au fost trimise spre aprobare!</p>
                <p className="text-emerald-600 text-xs mt-0.5">Vei primi un email după ce sunt revizuite.</p>
              </div>
            )}

            {/* File picker */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={state.drafts.length >= 6 || state.submitting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-300 text-sm hover:border-violet-500 hover:text-violet-300 transition-colors disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {state.drafts.length === 0 ? "Selectează poze" : `Adaugă mai multe (${state.drafts.length}/6)`}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  className="hidden"
                  onChange={(event) => handlePickFiles(event.target.files)}
                />
              </div>

              {state.submitError && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {state.submitError}
                </p>
              )}
            </div>

            {/* Draft editor */}
            {state.drafts.length > 0 && (
              <>
                {/* Featured photo */}
                <div
                  className="relative rounded-xl overflow-hidden bg-neutral-950"
                  style={{ aspectRatio: "4/3" }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <img
                    src={currentDraft.preview}
                    alt=""
                    className="w-full h-full object-contain"
                  />

                  {currentDraft.aiLoading && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-neutral-300 text-xs">Analizează poza...</p>
                    </div>
                  )}

                  {currentDraft.progress !== null && !currentDraft.aiLoading && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                      <p className="text-white font-semibold text-lg">{currentDraft.progress}%</p>
                      <div className="w-36 bg-neutral-700 rounded-full h-1.5">
                        <div
                          className="bg-violet-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${currentDraft.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {state.draftIndex > 0 && (
                    <button
                      onClick={() => dispatch({ type: "SET_DRAFT_INDEX", index: state.draftIndex - 1 })}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      ‹
                    </button>
                  )}
                  {state.draftIndex < state.drafts.length - 1 && (
                    <button
                      onClick={() => dispatch({ type: "SET_DRAFT_INDEX", index: state.draftIndex + 1 })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white text-xl flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      ›
                    </button>
                  )}

                  {!state.submitting && (
                    <button
                      onClick={() => dispatch({ type: "REMOVE_DRAFT", index: state.draftIndex })}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  )}

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/60 text-white text-xs">
                    {state.draftIndex + 1} / {state.drafts.length}
                  </div>
                </div>

                {/* Thumbnails */}
                {state.drafts.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {state.drafts.map((draft, index) => (
                      <button
                        key={index}
                        onClick={() => dispatch({ type: "SET_DRAFT_INDEX", index })}
                        className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          index === state.draftIndex ? "border-violet-500" : "border-transparent opacity-50 hover:opacity-90"
                        }`}
                      >
                        <img src={draft.preview} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* AI button */}
                <button
                  onClick={() => suggestAI(state.draftIndex)}
                  disabled={currentDraft.aiLoading || state.submitting}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 disabled:opacity-40 transition-colors"
                >
                  {currentDraft.aiLoading
                    ? <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    : <span>✦</span>
                  }
                  Sugerează tag-uri AI pentru această poză
                </button>

                {/* Tags */}
                <div>
                  <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium mb-2">
                    Tag-uri
                    {currentDraft.tags.length > 0
                      ? <span className="ml-1.5 text-violet-400 normal-case font-normal">· {currentDraft.tags.length} selectate</span>
                      : <span className="ml-1.5 text-neutral-600 normal-case font-normal">(opțional)</span>
                    }
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {PRESET_TAGS.map((tag) => (
                      <TagPill
                        key={tag}
                        tag={tag}
                        selected={currentDraft.tags.includes(tag)}
                        onClick={() => toggleTag(tag)}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      className="flex-1 bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-1.5 outline-none focus:border-violet-500 transition-colors placeholder-neutral-600"
                      placeholder="Tag custom..."
                      value={state.customTag}
                      onChange={(event) => dispatch({ type: "SET_CUSTOM_TAG", value: event.target.value })}
                      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }}
                    />
                    <button
                      onClick={addCustomTag}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
                    >
                      Adaugă
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-neutral-400 text-xs uppercase tracking-wide font-medium mb-1">
                    Notă · poza {state.draftIndex + 1}
                    <span className="normal-case font-normal text-neutral-600 ml-1">(opțional)</span>
                  </p>
                  <textarea
                    className="w-full bg-neutral-800 text-white text-sm border border-neutral-700 rounded-lg px-3 py-2 outline-none focus:border-neutral-500 transition-colors resize-none placeholder-neutral-600"
                    rows={2}
                    placeholder="ex: lumină naturală, moment special..."
                    value={currentDraft.notes}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_DRAFT", index: state.draftIndex, updates: { notes: event.target.value } })
                    }
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={state.submitting || state.drafts.length === 0}
                  className="w-full px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors"
                >
                  {state.submitting
                    ? "Se încarcă și trimite..."
                    : `Propune ${state.drafts.length} ${state.drafts.length === 1 ? "poză" : "poze"} spre aprobare`
                  }
                </button>
              </>
            )}

            {/* Past proposals */}
            {state.proposalsLoading && (
              <p className="text-neutral-600 text-sm text-center py-4">Se încarcă propunerile...</p>
            )}

            {!state.proposalsLoading && state.proposals.length > 0 && (
              <div className="space-y-3">
                <p className="text-neutral-500 text-xs uppercase tracking-wide font-medium">
                  Propunerile tale ({state.proposals.length})
                </p>
                {state.proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="flex gap-3 items-start bg-neutral-900 border border-neutral-800 rounded-xl p-3"
                  >
                    <img
                      src={proposal.url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={proposal.status} />
                        <span className="text-neutral-600 text-xs">
                          {new Date(proposal.proposedAt).toLocaleDateString("ro-RO")}
                        </span>
                      </div>
                      {proposal.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {proposal.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-xs">
                              {tag}
                            </span>
                          ))}
                          {proposal.tags.length > 4 && (
                            <span className="text-neutral-600 text-xs">+{proposal.tags.length - 4}</span>
                          )}
                        </div>
                      )}
                      {proposal.status === "rejected" && proposal.rejectionReason && (
                        <p className="text-red-400 text-xs mt-1 bg-red-500/10 rounded-lg px-2 py-1">
                          {proposal.rejectionReason}
                        </p>
                      )}
                      {proposal.status === "rejected" && !proposal.rejectionReason && (
                        <p className="text-red-400/60 text-xs mt-1">
                          Poza nu corespunde stilului galeriei.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Galerie Inspirație ──────────────────────────── */}
        {state.tab === "gallery" && (
          <div>
            {state.galleryLoading && <AncaLoader />}
            {!state.galleryLoading && state.galleryPhotos.length === 0 && (
              <p className="text-neutral-600 text-sm text-center py-10">
                Galeria e goală momentan.
              </p>
            )}
            {!state.galleryLoading && state.galleryPhotos.length > 0 && (
              <>
                <p className="text-neutral-500 text-sm mb-4">
                  {state.galleryPhotos.length} poze în galerie
                </p>
                <div style={{ columns: "2 140px", columnGap: "8px" }}>
                  {state.galleryPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative rounded-xl overflow-hidden border border-neutral-800 mb-2 break-inside-avoid"
                    >
                      <img
                        src={photo.url}
                        alt=""
                        className="w-full h-auto block"
                        loading="lazy"
                      />
                      {photo.tags.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 p-1.5 flex flex-wrap gap-1 bg-gradient-to-t from-black/60 to-transparent">
                          {photo.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 rounded-full bg-black/60 text-white text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
