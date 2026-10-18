"use client";

import { useState, type ReactNode } from "react";
import { AiLabel } from "@/components/ai/AiLabel";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { NotificationDraft } from "@/lib/types";
import styles from "./DraftMessage.module.scss";

export type DraftMessageProps = {
  draft: NotificationDraft;
  /** Who it goes to, e.g. "Thornquist Tools Ltd". */
  recipient: string;
  /** The button that opens the draft. */
  trigger: ReactNode;
  /** Called with the text as ops left it. Only here does anything reach the customer. */
  onApprove: (text: string) => void;
};

/**
 * The AI's draft customer message (A4) in a dialog: ops can edit it, then discard it or
 * approve and send it. Nothing is sent without that click (DESIGN §6, DraftMessage).
 */
export function DraftMessage({ draft, recipient, trigger, onApprove }: DraftMessageProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(draft.body);
  const textId = `draft-${draft.exceptionId}`;

  const approve = () => {
    onApprove(text);
    setOpen(false);
  };

  // Discard throws the edits away, so reopening shows the AI's draft again.
  const discard = () => {
    setText(draft.body);
    setOpen(false);
  };

  return (
    <Dialog trigger={trigger} title={draft.subject} open={open} onOpenChange={setOpen}>
      <dl className={styles.meta}>
        <dt>To</dt>
        <dd>{recipient}</dd>
        <dt>Shipment</dt>
        <dd>
          <code>{draft.shipmentId}</code>
        </dd>
      </dl>
      <label htmlFor={textId} className={styles.label}>
        <AiLabel /> Message
      </label>
      <textarea id={textId} className={styles.text} value={text} onChange={(e) => setText(e.target.value)} rows={10} />
      <div className={styles.actions}>
        <Button onClick={discard}>Discard</Button>
        <Button variant="primary" onClick={approve} disabled={text.trim() === ""}>
          Approve &amp; send
        </Button>
      </div>
      <p className={styles.footer}>Drafted by AI. Review before sending.</p>
    </Dialog>
  );
}
