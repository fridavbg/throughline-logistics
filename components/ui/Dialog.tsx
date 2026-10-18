"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./Dialog.module.scss";

export type DialogProps = {
  /** The element that opens the dialog, usually a {@link Button}. Radix wires up its click and focus. */
  trigger: ReactNode;
  title: string;
  /** One line under the title. Screen readers announce it when the dialog opens. */
  description?: string;
  children: ReactNode;
  /** Pass `open` and `onOpenChange` to control the dialog from outside, e.g. close it after "Approve & send". */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A modal dialog built on Radix, which handles focus trapping, Escape to close and
 * returning focus to the trigger. This component only adds the styling.
 */
export function Dialog({ trigger, title, description, children, open, onOpenChange }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {/* asChild: the trigger passed in becomes the button, instead of a button inside a button. */}
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          // Without a description, tell Radix on purpose so it doesn't warn about a missing one.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className={styles.header}>
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            <RadixDialog.Close className={styles.close} aria-label="Close">
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </RadixDialog.Close>
          </div>
          {description && (
            <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
