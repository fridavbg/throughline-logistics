/**
 * Client state for the demo: who is logged in, and what ops has done in the inbox. Simulated
 * events join it with the demo panel (F6). Spec: docs/RATIONALE.md §2.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { users } from "@/data/seed";
import type { CustomerAlert, User } from "@/lib/types";

type DemoState = {
  /** The chosen persona's id, or null before anyone has picked one. */
  userId: string | null;
  /**
   * False until the persona saved in this tab has been read back. Pages wait for it before
   * redirecting, so a reload doesn't bounce a logged-in persona to the picker.
   */
  hasHydrated: boolean;
  signIn: (userId: string) => void;
  /** Exceptions ops has dealt with in any way (resolved, snoozed, operator contacted, message sent); hidden from the inbox. */
  handledIds: string[];
  /**
   * The subset that settles it for the customer: resolved, or answered with an approved message.
   * Only these stop the escalation acknowledgement; a snooze or a call to the operator doesn't
   * tell the customer anything (PRD §6).
   */
  settledIds: string[];
  /** Messages ops approved and sent to customers, newest first. */
  sentAlerts: CustomerAlert[];
  /** Hides an exception from the inbox for now (snooze, operator contacted). */
  handle: (exceptionId: string) => void;
  /** Hides an exception and marks it settled: the problem is gone. */
  resolve: (exceptionId: string) => void;
  /** Sends an approved message: the customer sees it, and its exception counts as handled. */
  send: (exceptionId: string, alert: CustomerAlert) => void;
};

/**
 * The demo store. Only `userId` is saved, in sessionStorage: a reload or a pasted link keeps
 * the persona, and closing the tab resets the demo. What ops does in the inbox lives in memory
 * only, so switching persona keeps it but a reload starts the demo over.
 */
export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      userId: null,
      hasHydrated: false,
      signIn: (userId) => set({ userId }),
      handledIds: [],
      settledIds: [],
      sentAlerts: [],
      handle: (exceptionId) => set((state) => ({ handledIds: [...state.handledIds, exceptionId] })),
      resolve: (exceptionId) =>
        set((state) => ({
          handledIds: [...state.handledIds, exceptionId],
          settledIds: [...state.settledIds, exceptionId],
        })),
      send: (exceptionId, alert) =>
        set((state) => ({
          handledIds: [...state.handledIds, exceptionId],
          settledIds: [...state.settledIds, exceptionId],
          sentAlerts: [alert, ...state.sentAlerts],
        })),
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
