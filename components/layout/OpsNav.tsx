"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./OpsNav.module.scss";

const LINKS = [
  { href: "/ops", label: "Attention" },
  { href: "/ops/shipments", label: "Shipments" },
];

/**
 * The ops pages as tabs under the header: what needs attention, and every shipment. The
 * current page is marked with `aria-current`, so the underline is never the only signal.
 */
export function OpsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Ops pages" className={styles.nav}>
      <ul className={styles.list}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              className={styles.link}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
