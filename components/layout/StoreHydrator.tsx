"use client";

import { useEffect } from "react";
import { useDemoStore } from "@/lib/store";

/**
 * Reads the demo state saved in this tab (persona, what ops did, demo events) back into the
 * store, once, after the first render.
 * Mounted in the root layout. Renders nothing. See the note on `skipHydration` in lib/store.ts.
 */
export function StoreHydrator() {
  useEffect(() => {
    // Zustand leaves out the persist API when sessionStorage is blocked, e.g. by privacy
    // settings. Then there's nothing to read back, and the demo starts at the picker.
    if (useDemoStore.persist) {
      void useDemoStore.persist.rehydrate();
    } else {
      useDemoStore.setState({ hasHydrated: true });
    }
  }, []);
  return null;
}
