"use client";

import { useRouter } from "next/navigation";
import { customers, sites, users } from "@/data/seed";
import { homePath, perimeterLabel, roleLabel } from "@/lib/personas";
import { useCurrentUser, useDemoStore } from "@/lib/store";
import type { User } from "@/lib/types";
import styles from "./PersonaPicker.module.scss";

/** The demo login: one button per persona. Choosing one logs in and opens that role's home. */
export function PersonaPicker() {
  const router = useRouter();
  const signIn = useDemoStore((state) => state.signIn);
  const current = useCurrentUser();

  function choose(user: User) {
    signIn(user.id);
    router.push(homePath(user.role));
  }

  return (
    <ul className={styles.list}>
      {users.map((user) => (
        <li key={user.id}>
          <button
            type="button"
            className={styles.option}
            onClick={() => choose(user)}
            aria-current={user.id === current?.id ? "true" : undefined}
          >
            <span className={styles.name}>{user.name}</span>
            <span className={styles.role}>{roleLabel(user)}</span>
            <span className={styles.perimeter}>Sees: {perimeterLabel(user, sites, customers)}</span>
            {user.id === current?.id && <span className={styles.current}>Current persona</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
