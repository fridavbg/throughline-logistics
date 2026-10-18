"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { customers, sites, users } from "@/data/seed";
import { homePath, perimeterLabel, roleLabel } from "@/lib/personas";
import { useCurrentUser, useDemoStore } from "@/lib/store";
import type { User } from "@/lib/types";
import styles from "./RoleSwitcher.module.scss";

/**
 * The header control showing who you're logged in as, with a list to switch persona.
 * Switching within a role keeps you on the page, which updates at once; switching to
 * another role opens that role's home.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const signIn = useDemoStore((state) => state.signIn);
  const current = useCurrentUser();
  // Nothing to show before the saved persona is read back; RoleGate shows a skeleton meanwhile.
  if (!current) return null;

  function choose(user: User) {
    setOpen(false);
    signIn(user.id);
    if (current && user.role !== current.role) router.push(homePath(user.role));
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button>
          <span className={styles.triggerName}>{current.name}</span>
          <span className={styles.triggerRole}>{roleLabel(current)}</span>
          <span className={styles.triggerPerimeter}>{perimeterLabel(current, sites, customers)}</span>
          <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.content} align="end" sideOffset={8}>
          <p className={styles.heading}>Switch persona</p>
          <ul className={styles.list}>
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className={styles.option}
                  onClick={() => choose(user)}
                  aria-current={user.id === current.id ? "true" : undefined}
                >
                  <span className={styles.optionName}>
                    {user.name} · {roleLabel(user)}
                    {user.id === current.id && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}
                  </span>
                  <span className={styles.optionPerimeter}>{perimeterLabel(user, sites, customers)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
