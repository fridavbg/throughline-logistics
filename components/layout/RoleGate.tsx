"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { redirectFor } from "@/lib/personas";
import { useCurrentUser, useDemoStore } from "@/lib/store";
import type { User } from "@/lib/types";
import styles from "./RoleGate.module.scss";

export type RoleGateProps = {
  /** The role this page is for. Leave it out for a page every role may open, such as shipment detail. */
  role?: User["role"];
  children: ReactNode;
};

/**
 * Shows the page only to a persona with the right role (or any persona, without `role`). With
 * no persona it goes to the picker; with another role it goes to that role's own home. Until
 * the saved persona has been read back, it shows a skeleton instead of redirecting too early.
 */
export function RoleGate({ role, children }: RoleGateProps) {
  const router = useRouter();
  const hasHydrated = useDemoStore((state) => state.hasHydrated);
  const user = useCurrentUser();
  const target = hasHydrated ? redirectFor(user, role) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  if (!hasHydrated || target) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton width="40%" />
        <Skeleton height="var(--space-7)" />
        <Skeleton height="var(--space-7)" />
      </div>
    );
  }
  return children;
}
