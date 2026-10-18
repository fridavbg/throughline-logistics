/**
 * Client state for the demo: who is logged in. Simulated events join it with the demo
 * panel (F6). Spec: docs/RATIONALE.md §2.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { users } from "@/data/seed";
import type { User } from "@/lib/types";

type DemoState = {
  /** The chosen persona's id, or null before anyone has picked one. */
  userId: string | null;
  /**
   * False until the persona saved in this tab has been read back. Pages wait for it before
   * redirecting, so a reload doesn't bounce a logged-in persona to the picker.
   */
  hasHydrated: boolean;
  signIn: (userId: string) => void;
};

/**
 * The demo store. Only `userId` is saved, in sessionStorage: a reload or a pasted link keeps
 * the persona, and closing the tab resets the demo.
 */
export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      userId: null,
      hasHydrated: false,
      signIn: (userId) => set({ userId }),
    }),
    {
      name: "throughline-persona",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ userId: state.userId }),
      // The server has no sessionStorage, so it always renders "no persona". Reading it back
      // straight away would make the browser's first render differ from the server's (a
      // hydration mismatch), so StoreHydrator calls rehydrate() after the first render instead.
      skipHydration: true,
      onRehydrateStorage: () => () => useDemoStore.setState({ hasHydrated: true }),
    },
  ),
);

/**
 * The logged-in persona, looked up in the seed data. Only the id is stored, so a saved id
 * that no longer matches a persona simply means nobody is logged in.
 */
export function useCurrentUser(): User | undefined {
  const userId = useDemoStore((state) => state.userId);
  return users.find((user) => user.id === userId);
}
