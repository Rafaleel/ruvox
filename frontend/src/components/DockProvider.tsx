import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DockContextValue = {
  /** True while at least one screen asked to hide the dock. */
  hidden: boolean;
  /** Registers one hide request; call the returned function to release it. */
  requestHide: () => () => void;
};

const DockContext = createContext<DockContextValue | null>(null);

/** Owns the "dock hidden" state. `Layout` mounts it above the routes. */
export function DockProvider({ children }: { children: ReactNode }) {
  // A counter, not a boolean: overlapping screens and StrictMode's double
  // mount can never leave the dock stuck hidden or flash it back early.
  const [requests, setRequests] = useState(0);
  const requestHide = useCallback(() => {
    setRequests((n) => n + 1);
    return () => setRequests((n) => n - 1);
  }, []);
  const value = useMemo(
    () => ({ hidden: requests > 0, requestHide }),
    [requests, requestHide],
  );
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

/** Whether the dock should be off screen (used by the dock itself). */
export const useDockHidden = () => useContext(DockContext)?.hidden ?? false;

/**
 * Hides the floating dock while the calling screen is mounted (or while
 * `hidden` is true). A no-op outside `DockProvider`, so session screens render
 * fine in isolation and in tests.
 */
export function useHideDock(hidden = true) {
  const requestHide = useContext(DockContext)?.requestHide;
  useEffect(() => {
    if (!hidden || !requestHide) return;
    return requestHide();
  }, [hidden, requestHide]);
}
