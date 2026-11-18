'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react';

/** Поколение навигации, не выбранный проект. Уход и возврат не оживляют callbacks. */
export function useNavigationIntent() {
  const pathname = usePathname();
  const params = useSearchParams();
  const url = `${pathname}?${params.toString()}`;
  const state = useRef({ url, generation: 0, active: true });
  const canonical = useRef<{ from: string; to: string; generation: number } | null>(null);
  const requests = useRef(new WeakMap<object, () => boolean>());
  const invalidate = useCallback(() => {
    canonical.current = null;
    state.current.generation++;
  }, []);
  useLayoutEffect(() => {
    if (state.current.url !== url) {
      const ownCanonical =
        canonical.current?.from === state.current.url &&
        canonical.current.to === url &&
        canonical.current.generation === state.current.generation;
      state.current.url = url;
      if (!ownCanonical) state.current.generation++;
      canonical.current = null;
    }
  }, [url]);
  useEffect(() => {
    window.addEventListener('popstate', invalidate);
    return () => {
      window.removeEventListener('popstate', invalidate);
    };
  }, [invalidate]);
  const capture = useCallback(() => {
    const generation = state.current.generation;
    return () => state.current.active && state.current.generation === generation;
  }, []);
  const setActive = useCallback((active: boolean) => {
    state.current.active = active;
  }, []);
  const getRevision = useCallback(() => state.current.generation, []);
  // Только заранее объявленный canonical replace сохраняет исходное намерение.
  const markCanonical = useCallback((to: string) => {
    canonical.current = { from: state.current.url, to, generation: state.current.generation };
  }, []);
  // Один уже отправленный GET не получает новое намерение после remount раздела.
  const captureRequest = useCallback(
    (request: object | undefined) => {
      if (!request) return capture();
      let isCurrent = requests.current.get(request);
      if (!isCurrent) {
        isCurrent = capture();
        requests.current.set(request, isCurrent);
      }
      return isCurrent;
    },
    [capture],
  );
  return {
    capture,
    captureRequest,
    getRevision,
    markCanonical,
    invalidate,
    setActive,
    pathname,
    params,
    url,
  };
}

export const NavigationIntentContext = createContext<ReturnType<typeof useNavigationIntent> | null>(
  null,
);

export function useCurrentNavigationIntent() {
  const local = useNavigationIntent();
  return useContext(NavigationIntentContext) ?? local;
}
