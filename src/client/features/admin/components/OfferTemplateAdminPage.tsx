import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import useAuth from "../auth/useAuth";
import AncaLoader from "../../../components/UI/AncaLoader";
import { type OfferAssetKind } from "../../../../shared/offers/offerServices";

type SelectedAsset = {
  id: string;
  kind: OfferAssetKind;
  url: string;
  label: string;
};

type ShowcaseService = {
  id: string;
  label: string;
  description: string;
  assets: SelectedAsset[];
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`Serverul a raspuns gol (${response.status}).`);
  return JSON.parse(text) as T;
}

export default function OfferTemplateAdminPage() {
  const { auth } = useAuth();
  const [services, setServices] = useState<ShowcaseService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggingAsset, setDraggingAsset] = useState<{ serviceId: string; assetId: string } | null>(null);
  const [dragOverAsset, setDragOverAsset] = useState<{ serviceId: string; assetId: string } | null>(null);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    void loadShowcase();
  }, [auth.accessToken]);

  async function loadShowcase() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/oferte/admin/template-showcase", {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await readJsonResponse<{ services?: ShowcaseService[]; error?: string }>(response);
      if (!response.ok || !data.services) throw new Error(data.error ?? "Nu am putut incarca template-urile.");
      setServices(data.services);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  function moveAsset(serviceId: string, fromId: string, toId: string) {
    setServices(prev => prev.map(service => {
      if (service.id !== serviceId) return service;
      const assets = [...service.assets];
      const fromIndex = assets.findIndex(a => a.id === fromId);
      const toIndex = assets.findIndex(a => a.id === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return service;
      const [moved] = assets.splice(fromIndex, 1);
      assets.splice(toIndex, 0, moved);
      return { ...service, assets };
    }));
  }

  async function saveOrder(service: ShowcaseService) {
    if (!auth.accessToken) return;
    setSavingServiceId(service.id);
    try {
      await fetch(`/api/oferte/admin/template-showcase/${service.id}/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ assetIds: service.assets.map(a => a.id) }),
      });
      setSavedServiceId(service.id);
      setTimeout(() => setSavedServiceId(null), 2000);
    } catch {
      setError("Eroare la salvare.");
    } finally {
      setSavingServiceId(null);
    }
  }

  if (loading) return <AncaLoader />;

  return (
    <div>
      <Breadcrumb />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-light text-white">Template Oferte</h1>
            <p className="text-sm text-neutral-500">
              Trage pozele pentru a le reordona, apoi apasa Salveaza.
            </p>
          </div>
          <Link
            to="/admin/media-assets"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
          >
            Deschide Media Assets
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-5">
          {services.map(service => (
            <section key={service.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-white text-lg font-medium">{service.label}</h2>
                  <p className="mt-1 text-sm text-neutral-500 max-w-2xl">{service.description}</p>
                  <p className="mt-3 text-xs text-neutral-600">
                    {service.assets.length} asset-uri selectate pentru clienti
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to="/admin/media-assets"
                    className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
                  >
                    Adauga in biblioteca
                  </Link>
                  <Link
                    to={`/admin/template-oferte/${service.id}`}
                    className="rounded-lg border border-violet-700 px-3 py-2 text-xs text-violet-300 transition-colors hover:bg-violet-900/30"
                  >
                    Alege asset-uri
                  </Link>
                  {service.assets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void saveOrder(service)}
                      disabled={savingServiceId === service.id}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:bg-neutral-700 disabled:text-neutral-500"
                    >
                      {savingServiceId === service.id ? "..." : savedServiceId === service.id ? "Salvat!" : "Salveaza"}
                    </button>
                  )}
                </div>
              </div>

              {service.assets.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {service.assets.map((asset, index) => (
                    <article
                      key={asset.id}
                      draggable
                      onDragStart={() => setDraggingAsset({ serviceId: service.id, assetId: asset.id })}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!draggingAsset || draggingAsset.serviceId !== service.id || draggingAsset.assetId === asset.id) return;
                        setDragOverAsset({ serviceId: service.id, assetId: asset.id });
                      }}
                      onDrop={() => {
                        if (!draggingAsset || draggingAsset.serviceId !== service.id) return;
                        moveAsset(service.id, draggingAsset.assetId, asset.id);
                        setDragOverAsset(null);
                      }}
                      onDragEnd={() => { setDraggingAsset(null); setDragOverAsset(null); }}
                      className={`overflow-hidden rounded-2xl border bg-neutral-950 cursor-grab active:cursor-grabbing transition-opacity ${
                        draggingAsset?.assetId === asset.id ? "opacity-40 border-violet-700"
                        : dragOverAsset?.assetId === asset.id ? "border-violet-500 ring-1 ring-violet-500"
                        : "border-neutral-800"
                      }`}
                    >
                      <div className="relative">
                        {asset.kind === "video" ? (
                          <video src={asset.url} className="h-40 w-full object-cover" muted draggable={false} />
                        ) : (
                          <img src={asset.url} alt={asset.label} className="h-40 w-full object-cover" loading="lazy" draggable={false} />
                        )}
                        <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white pointer-events-none">
                          #{index + 1}
                        </div>
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
          ))}
        </div>
      </div>
    </div>
  );
}
