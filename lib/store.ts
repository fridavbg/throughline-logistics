/**
 * Client state for the demo: who is logged in, what ops has done in the inbox, and which demo
 * panel events (F6) have been triggered. Spec: docs/RATIONALE.md §2.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { eventsFor, type DemoEventId } from "@/data/demoEvents";
import { users } from "@/data/seed";
import { getShipments } from "@/data/shipments";
import type { CustomerAlert, Shipment, User } from "@/lib/types";

type DemoState = {
  /** The chosen persona's id, or null before anyone has picked one. */
  userId: string | null;
  /**
   * False until the state saved in this tab has been read back. Pages wait for it before
   * redirecting or listing anything, so a reload doesn't bounce a logged-in persona to the
   * picker or flash a handled item back into the inbox.
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
  /**
   * Demo panel events triggered so far, in order. Only the ids are kept: the shipments are
   * rebuilt from them (`useShipments`), so nothing derived is ever stored.
   */
  triggeredEventIds: DemoEventId[];
  /** Delivers a demo event's operator messages; a second click on the same event does nothing. */
  trigger: (eventId: DemoEventId) => void;
  /** Back to the seed state: no demo events, nothing handled or sent. The persona stays. */
  resetDemo: () => void;
};

/**
 * The demo store, saved in sessionStorage: a reload or a pasted link keeps the persona, what
 * ops did and the demo events triggered; closing the tab or *Reset demo* starts over. Only ids
 * and sent messages are saved, never shipments: those are rebuilt from the event ids, and an
 * id that's no longer a demo event is skipped by `eventsFor`.
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
      triggeredEventIds: [],
      trigger: (eventId) =>
        set((state) =>
          state.triggeredEventIds.includes(eventId) ? state : { triggeredEventIds: [...state.triggeredEventIds, eventId] },
        ),
      resetDemo: () => set({ triggeredEventIds: [], handledIds: [], settledIds: [], sentAlerts: [] }),
    }),
    {
      // Renamed from "throughline-persona" when it started holding more than the persona; an
      // old saved persona is ignored, so that tab shows the picker once.
      name: "throughline-demo",
      storage: createJSONStorage(() => sessionStorage),
      partialize: savedState,
      // The server has no sessionStorage, so it always renders "no persona". Reading it back
      // straight away would make the browser's first render differ from the server's (a
      // hydration mismatch), so StoreHydrator calls rehydrate() after the first render instead.
      skipHydration: true,
      onRehydrateStorage: () => () => useDemoStore.setState({ hasHydrated: true }),
    },
  ),
);

/**
 * What survives a reload: the persona and what happened in the demo, but no actions and no
 * `hasHydrated`, which must start false on every page load.
 */
export function savedState(state: DemoState) {
  const { userId, handledIds, settledIds, sentAlerts, triggeredEventIds } = state;
  return { userId, handledIds, settledIds, sentAlerts, triggeredEventIds };
}

/**
 * The logged-in persona, looked up in the seed data. Only the id is stored, so a saved id
 * that no longer matches a persona simply means nobody is logged in.
 */
export function useCurrentUser(): User | undefined {
  const userId = useDemoStore((state) => state.userId);
  return users.find((user) => user.id === userId);
}

/**
 * Every shipment as the demo stands now: the seed plus the demo events triggered so far.
 * Each view rebuilds it only when an event is triggered or the demo is reset, and every view
 * starts from the same data, so status, ETA, exceptions and alerts recompute together.
 */
export function useShipments(): Shipment[] {
  const triggered = useDemoStore((state) => state.triggeredEventIds);
  return useMemo(() => getShipments(eventsFor(triggered)), [triggered]);
}
