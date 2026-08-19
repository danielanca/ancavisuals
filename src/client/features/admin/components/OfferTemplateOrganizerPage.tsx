import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import { type OfferAssetKind } from "../../../../shared/offers/offerServices";

type OfferMediaAsset = {
  id: string;
  serviceId: string;
  kind: OfferAssetKind;
  url: string;
  label: string;
  displayUrl?: string;
};

type ShowcaseService = {
  id: string;
  label: string;
  description: string;
  assets: OfferMediaAsset[];
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`Serverul a raspuns gol (${response.status}).`);
  return JSON.parse(text) as T;
}

export default function OfferTemplateOrganizerPage() {
  const { auth } = useAuth();
  const { serviceId = "" } = useParams<{ serviceId: string }>();
  const [services, setServices] = useState<ShowcaseService[]>([]);
  const [library, setLibrary] = useState<OfferMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) return;
    void Promise.all([loadShowcase(), loadLibrary()]);
  }, [auth.accessToken, serviceId]);

  const service = useMemo(
    () => services.find(item => item.id === serviceId) ?? null,
    [services, serviceId],
  );

  const selectedIds = new Set(service?.assets.map(asset => asset.id) ?? []);
  const availableAssets = library.filter(asset => !selectedIds.has(asset.id));
  const assetUrl = (asset: OfferMediaAsset) => asset.displayUrl ?? asset.url;

  async function loadShowcase() {
    try {
      const response = await fetch("/api/oferte/admin/template-showcase", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ services?: ShowcaseService[]; error?: string }>(response);
      if (!response.ok || !data.services) throw new Error(data.error ?? "Nu am putut incarca template-ul.");
      setServices(data.services);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary() {
    try {
      const response = await fetch(`/api/oferte/admin/media-assets?serviceId=${encodeURIComponent(serviceId)}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets) throw new Error(data.error ?? "Nu am putut incarca biblioteca.");
      setLibrary(data.assets);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  function replaceServiceAssets(nextAssets: OfferMediaAsset[]) {
    setServices(current => current.map(item => (
      item.id === serviceId ? { ...item, assets: nextAssets } : item
    )));
  }

  function addAsset(asset: OfferMediaAsset) {
    if (!service || selectedIds.has(asset.id)) return;
    replaceServiceAssets([...service.assets, asset]);
  }

  function removeAsset(assetId: string) {
    if (!service) return;
    replaceServiceAssets(service.assets.filter(asset => asset.id !== assetId));
  }

  function moveAsset(fromId: string, toId: string) {
    if (!service) return;
    const assets = [...service.assets];
    const fromIndex = assets.findIndex(asset => asset.id === fromId);
    const toIndex = assets.findIndex(asset => asset.id === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [moved] = assets.splice(fromIndex, 1);
    assets.splice(toIndex, 0, moved);
    replaceServiceAssets(assets);
  }

  async function saveSelection() {
    if (!service) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/oferte/admin/template-showcase/${service.id}/order`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ assetIds: service.assets.map(asset => asset.id) }),
      });
      const data = await readJsonResponse<{ assets?: OfferMediaAsset[]; error?: string }>(response);
      if (!response.ok || !data.assets) throw new Error(data.error ?? "Nu am putut salva selectia.");
      replaceServiceAssets(data.assets);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AncaLoader />;

  if (!service) {
    return (
      <div>
        <Breadcrumb />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 text-neutral-400">
            Serviciul nu a fost gasit.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Template Oferte</p>
            <h1 className="text-2xl font-light text-white">{service.label}</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-500">
              Alege asset-urile din biblioteca globala si pune-le in ordinea in care vrei sa le vada clientul.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/media-assets"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
            >
              Media Assets
            </Link>
            <button
              type="button"
              onClick={() => void saveSelection()}
              disabled={saving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500"
            >
              {saving ? "Se salveaza..." : "Salveaza selectia"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-white text-lg font-medium">Ordinea pentru client</h2>
              <p className="mt-1 text-sm text-neutral-500">Trage cardurile pentru reordonare. Eliminarea de aici nu sterge asset-ul din biblioteca.</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-600">Drag pentru reordonare</p>
            </div>
            <div className="text-xs text-neutral-500">{service.assets.length} selectate</div>
          </div>

          {service.assets.length > 0 ? (
            <div className="mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
              {service.assets.map((asset, index) => (
                <article
                  key={asset.id}
                  draggable
                  onDragStart={() => setDraggingId(asset.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!draggingId || draggingId === asset.id) return;
                    setDragOverId(asset.id);
                  }}
                  onDrop={() => {
                    if (!draggingId || draggingId === asset.id) return;
                    moveAsset(draggingId, asset.id);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  className={`group mb-3 break-inside-avoid overflow-hidden rounded-2xl border bg-neutral-950 cursor-grab active:cursor-grabbing transition-opacity ${
                    draggingId === asset.id ? "opacity-40 border-violet-700"
                    : dragOverId === asset.id ? "border-violet-500 ring-1 ring-violet-500"
                    : "border-neutral-800"
                  }`}
                >
                  <div className="relative bg-neutral-900">
                    {asset.kind === "video" ? (
                      <video src={assetUrl(asset)} className="block aspect-video w-full object-cover" muted draggable={false} />
                    ) : (
                      <img src={assetUrl(asset)} alt={asset.label} className="block h-auto w-full" loading="lazy" draggable={false} />
                    )}
                    <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white pointer-events-none">
                      #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAsset(asset.id)}
                      onDragStart={(e) => e.stopPropagation()}
                      className="absolute right-2 top-2 rounded-full bg-red-900/80 px-2 py-0.5 text-[10px] text-red-300 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
              Nu ai selectat inca asset-uri pentru acest serviciu.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-white text-lg font-medium">Biblioteca pentru {service.label}</h2>
              <p className="mt-1 text-sm text-neutral-500">Alege rapid din asset-urile deja urcate in Bunny.</p>
            </div>
            <div className="text-xs text-neutral-500">{availableAssets.length} disponibile</div>
          </div>

          {availableAssets.length > 0 ? (
            <div className="mt-5 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
              {availableAssets.map(asset => (
                <article key={asset.id} className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
                  <div className="relative bg-neutral-900">
                    {asset.kind === "video" ? (
                      <video src={assetUrl(asset)} className="block aspect-video w-full object-cover" muted />
                    ) : (
                      <img src={assetUrl(asset)} alt={asset.label} className="block h-auto w-full" loading="lazy" />
                    )}
                    <button
                      type="button"
                      onClick={() => addAsset(asset)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 text-white text-xs font-semibold"
                    >
                      + Adauga
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
              Nu mai exista alte asset-uri disponibile pentru acest serviciu. Daca ai nevoie de mai multe, urca-le in Media Assets.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
