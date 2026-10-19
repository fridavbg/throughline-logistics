"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, FlaskConical, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { demoEvents, type DemoEvent } from "@/data/demoEvents";
import { findVisibleShipment } from "@/lib/access";
import { useCurrentUser, useDemoStore, useShipments } from "@/lib/store";
import styles from "./DemoPanel.module.scss";

/** What the notice above the Demo button reports: the last event sent, or a reset. */
type Notice = DemoEvent | "reset" | null;

/** How long the reset notice stays. Event notices stay until dismissed: they hold a link. */
const RESET_NOTICE_MS = 4000;

/**
 * The demo panel (F6): a floating "Demo" button, bottom right, that pushes scripted operator
 * messages into the app so anyone running the demo can watch it react. Dashed, so it's clearly
 * not product UI. Hidden until a persona is chosen, like the role switcher.
 *
 * After an event the panel closes so the page is visible, and a notice says what changed,
 * with a link to the shipment, or that the shipment is outside this persona's perimeter.
 * Opening the panel again clears the notice.
 */
export function DemoPanel() {
  const user = useCurrentUser();
  const shipments = useShipments();
  const triggered = useDemoStore((state) => state.triggeredEventIds);
  const trigger = useDemoStore((state) => state.trigger);
  const resetDemo = useDemoStore((state) => state.resetDemo);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (notice !== "reset") return;
    const timer = setTimeout(() => setNotice(null), RESET_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!user) return null;

  function toggle(next: boolean) {
    setOpen(next);
    if (next) setNotice(null);
  }

  function send(event: DemoEvent) {
    trigger(event.id);
    setOpen(false);
    setNotice(event);
  }

  function reset() {
    resetDemo();
    setOpen(false);
    setNotice("reset");
  }

  const visible = notice !== null && notice !== "reset" && findVisibleShipment(user, shipments, notice.shipmentId);

  return (
    <>
      {/* Always rendered, so screen readers announce each new notice (a live region). */}
      <div className={styles.notice} role="status">
        {notice === "reset" && <p>Demo reset to the starting state.</p>}
        {notice !== null && notice !== "reset" && (
          <p>
            <strong>
              {notice.label} · {notice.shipmentId}.
            </strong>{" "}
            {visible
              ? notice.effect
              : `${notice.shipmentId} is outside ${user.name}'s perimeter, so nothing changes here.`}
          </p>
        )}
        {notice !== null && (
          <div className={styles.noticeActions}>
            {visible && (
              <ButtonLink variant="ghost" href={`/shipments/${visible.id}`}>
                View {visible.id}
              </ButtonLink>
            )}
            <Button variant="ghost" onClick={() => setNotice(null)} aria-label="Dismiss notice">
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <Popover.Root open={open} onOpenChange={toggle}>
        <Popover.Trigger asChild>
          <button type="button" className={styles.trigger}>
            <FlaskConical size={20} strokeWidth={1.75} aria-hidden="true" />
            Demo
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className={styles.content} side="top" align="end" sideOffset={8}>
            <p className={styles.heading}>Demo events</p>
            <p className={styles.intro}>Each one simulates an operator message arriving now.</p>
            <ul className={styles.list}>
              {demoEvents.map((event) => {
                const sent = triggered.includes(event.id);
                return (
                  <li key={event.id} className={styles.event}>
                    <Button className={styles.eventButton} onClick={() => send(event)} disabled={sent}>
                      {sent && <Check size={20} strokeWidth={1.75} aria-hidden="true" />}
                      <span>
                        {event.label} · {event.shipmentId}
                        {sent && " · Sent"}
                      </span>
                    </Button>
                    <p className={styles.effect}>{event.effect}</p>
                  </li>
                );
              })}
            </ul>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={20} strokeWidth={1.75} aria-hidden="true" />
              Reset demo
            </Button>
            <p className={styles.note}>Reset also clears what ops handled or sent. Your persona stays.</p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
