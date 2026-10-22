import React, { useEffect, useState, type ComponentType } from "react";
import AncaLoader from "../components/UI/AncaLoader";

// A page whose code downloads only when it is opened (not with every page), yet still
// renders fully on the server for Google: the server preloads every such page at
// startup and tells the browser which ones it rendered (window.__SSR_LAZY__), and the
// browser loads those before hydrating — so the first render matches the server's.

declare global {
  interface Window { __SSR_LAZY__?: string[] }
}

const preloaders = new Map<string, () => Promise<void>>();
// Server only: keys rendered by the current renderToString (synchronous, so no overlap).
const renderedKeys = new Set<string>();

export function ssrLazy<P extends object>(key: string, load: () => Promise<{ default: ComponentType<P> }>): ComponentType<P> {
  let Loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  // A failed download (flaky network, a deploy that removed the old file) is not kept, so
  // the next attempt fetches again instead of replaying the same rejection.
  const preload = () => (pending ??= load().then(
    (module) => { Loaded = module.default; },
    (error) => { pending = null; throw error; },
  ));
  preloaders.set(key, preload);

  function SsrLazy(props: P) {
    const [Component, setComponent] = useState<ComponentType<P> | null>(() => Loaded);
    const [failure, setFailure] = useState<unknown>(null);
    useEffect(() => {
      if (Component) return;
      let active = true;
      preload().then(
        () => { if (active) setComponent(() => Loaded); },
        (error) => { if (active) setFailure(() => error); },
      );
      return () => { active = false; };
    }, [Component]);
    // Thrown in render so App's ChunkErrorBoundary reloads the page once, instead of an
    // unhandled rejection and the loader spinning forever.
    if (failure) throw failure;
    if (!Component) return <AncaLoader />;
    if (typeof window === "undefined") renderedKeys.add(key);
    return <Component {...props} />;
  }
  SsrLazy.displayName = `SsrLazy(${key})`;
  return SsrLazy;
}

/** Server, at startup: every lazy page ready, so renderToString renders it in full. */
export const preloadAllSsrLazy = () => Promise.all([...preloaders.values()].map((preload) => preload()));

/** Server, after a render: the lazy pages it contained, for the browser to preload. */
export function takeRenderedSsrLazyKeys(): string[] {
  const keys = [...renderedKeys];
  renderedKeys.clear();
  return keys;
}

/** Browser, before hydrating: load what the server rendered. */
export const preloadSsrLazy = (keys: string[]) =>
  Promise.all(keys.map((key) => preloaders.get(key)?.().catch(() => {})));
