import React, { useEffect, useMemo, useRef, useState } from "react";
import AncaLoader from "../../components/UI/AncaLoader";

export type PlaceLite = {
  id: string;
  displayName?: string;
  formattedAddress?: string;
  location?: google.maps.LatLngLiteral;
};

type Props = {
  apiKey: string;
  value?: string;
  onChange: (v: string) => void;
  onSelect: (p: PlaceLite) => void;
  placeholder?: string;
  language?: string; // ex: "ro"
  region?: string; // ex: "RO"
  includedPrimaryTypes?: string[]; // ex: ["street_address","establishment"]
  className?: string;
};

// ---------------- Loader + cache ----------------
let cachedPlacesLib: any | null = null;

const loadMaps = (() => {
  let promise: Promise<void> | null = null;
  return (apiKey: string, language?: string) => {
    // deja există
    if (typeof window !== "undefined" && (window as any).google?.maps) {
      return Promise.resolve();
    }
    if (!promise) {
      promise = new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        const params = new URLSearchParams({
          key: apiKey,
          libraries: "places",
          v: "weekly",
          loading: "async", // best practice
          ...(language ? { language } : {}),
        });
        s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        s.async = true;
        s.defer = true;
        s.onerror = () => reject(new Error("Failed to load Google Maps JS"));
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    }
    return promise;
  };
})();
function waitFor(test: () => boolean, timeout = 5000, step = 50) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const it = window.setInterval(() => {
      if (test()) {
        clearInterval(it);
        resolve();
      } else if (Date.now() - start >= timeout) {
        clearInterval(it);
        reject(new Error("timeout"));
      }
    }, step);
  });
}

async function ensurePlaces(apiKey: string, language?: string) {
  await loadMaps(apiKey, language);
  const gmaps: any = (window as any).google?.maps;
  if (!gmaps) throw new Error("google.maps not present after load");

  if (cachedPlacesLib) return cachedPlacesLib;

  // 1) Noul API (dacă e disponibil)
  if (typeof gmaps.importLibrary === "function") {
    try {
      cachedPlacesLib = await gmaps.importLibrary("places");
      return cachedPlacesLib;
    } catch {
      // continuăm cu fallback
    }
  }

  // 2) Fallback: așteptăm ca Google să atașeze namespace-ul clasic
  if (!gmaps.places) {
    // maps/api/js a rezolvat deja, dar places.js se atașează puțin mai târziu
    await waitFor(() => !!(window as any).google?.maps?.places, 5000, 50);
  }

  if (gmaps.places) {
    cachedPlacesLib = gmaps.places;
    return cachedPlacesLib;
  }

  console.error(
    "[Maps] google.maps este prezent, dar 'places' încă lipsește. " +
      "Verifică să nu existe un alt loader care a pornit fără `libraries=places`.",
  );
  throw new Error("Places library not available");
}

// ---------------- Component ----------------
export default function LocationField({
  apiKey,
  value = "", // default safe
  onChange,
  onSelect,
  placeholder = "Caută locația exactă…",
  language = "ro",
  region = "RO",
  includedPrimaryTypes,
  className,
}: Props) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const activeIndex = useRef<number>(-1);

  // init
  useEffect(() => {
    let mounted = true;
    ensurePlaces(apiKey, language)
      .then(places => {
        if (!mounted) return;
        // Noul API are AutocompleteSessionToken în lib-ul places,
        // și în fallback (global) de asemenea.
        tokenRef.current = new places.AutocompleteSessionToken();
        setReady(true);
      })
      .catch(e => {
        console.error(e);
        setErr("Nu s-a putut încărca Google Maps.");
      });
    return () => {
      mounted = false;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [apiKey, language]);

  const query = useMemo(() => (value ?? "").toString().trim(), [value]);

  // fetch predictions
  useEffect(() => {
    if (!ready) return;
    if (!query) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        setErr(null);
        const places = await ensurePlaces(apiKey, language);

        // Noul API: AutocompleteSuggestion.fetchAutocompleteSuggestions
        if (places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
          const req: any = {
            input: query,
            language,
            region,
            sessionToken: tokenRef.current || undefined,
            ...(includedPrimaryTypes?.length ? { includedPrimaryTypes } : {}),
          };
          const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
          setSuggestions(suggestions || []);
          setOpen(!!(suggestions && suggestions.length));
        } else {
          // Ca fallback ultim, încearcă să nu oprești UX-ul (returnează nimic)
          setSuggestions([]);
          setOpen(false);
          setErr("Autocomplete (Places New) indisponibil în această încărcare.");
        }
      } catch (e) {
        console.error(e);
        setErr("Autocomplete a eșuat.");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [query, ready, apiKey, language, region, includedPrimaryTypes]);

  async function handleSelect(sug: any) {
    try {
      setOpen(false);
      const places = await ensurePlaces(apiKey, language);

      const prediction = sug?.placePrediction;
      if (!prediction?.toPlace) return;

      const place = prediction.toPlace();
      if (place.fetchFields) {
        await place.fetchFields({
          fields: ["id", "displayName", "formattedAddress", "location"],
        });
      }

      const id = (place as any).id || (prediction?.id as string) || (prediction?.place_id as string) || "";
      const displayName = (place as any).displayName?.text;
      const formattedAddress = (place as any).formattedAddress;
      const loc = (place as any).location;
      const latlng = typeof loc?.toJSON === "function" ? loc.toJSON() : loc?.toJSON?.() ?? loc;

      // 🔥 setează și value-ul din input prin onChange
      const selectedText = formattedAddress || displayName || prediction?.text?.text || "";
      onChange(selectedText);

      onSelect({
        id,
        displayName,
        formattedAddress,
        location: latlng,
      });

      // reset sesiune după select
      tokenRef.current = new places.AutocompleteSessionToken();
    } catch (e) {
      console.error(e);
      setErr("Nu s-au putut încărca detaliile locului.");
    }
  }

  return (
    <div className={className} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          activeIndex.current = -1;
        }}
        onFocus={() =>
          (value ?? "").length >= 3 && Array.isArray(suggestions) && suggestions.length > 0 && setOpen(true)
        }
        onKeyDown={e => {
          if (!open || !Array.isArray(suggestions) || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex.current = Math.min(activeIndex.current + 1, suggestions.length - 1);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex.current = Math.max(activeIndex.current - 1, 0);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const idx = activeIndex.current >= 0 ? activeIndex.current : 0;
            handleSelect(suggestions[idx]);
            return;
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 4,
            borderRadius: 8,
            background: "#1f1f1f",
            border: "1px solid #2a2a2a",
            boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
            maxHeight: 280,
            overflowY: "auto",
          }}
          onMouseDown={e => e.preventDefault()}
        >
          {loading && <AncaLoader variant="inline" />}
          {err && <div style={{ padding: 10, color: "#ff8080" }}>{err}</div>}

          {!loading &&
            !err &&
            Array.isArray(suggestions) &&
            suggestions.length > 0 &&
            suggestions.map((sug: any, i: number) => {
              const t = sug.placePrediction?.text?.text || "";
              const sec = sug.placePrediction?.secondaryText?.text || "";
              const isActive = i === activeIndex.current;
              return (
                <div
                  key={`${t}-${sec}-${i}`}
                  onClick={() => handleSelect(sug)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: isActive ? "#2a2a2a" : "transparent",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t}</div>
                  {sec && <div style={{ fontSize: 12, opacity: 0.7 }}>{sec}</div>}
                </div>
              );
            })}

          {!loading && !err && (!Array.isArray(suggestions) || suggestions.length === 0) && (
            <div style={{ padding: 10, opacity: 0.7 }}>Nimic găsit</div>
          )}
        </div>
      )}
    </div>
  );
}
