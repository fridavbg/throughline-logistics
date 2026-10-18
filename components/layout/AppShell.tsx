import Link from "next/link";
import type { ReactNode } from "react";
import { formatDayTime, getNow } from "@/lib/time";
import styles from "./AppShell.module.scss";

export type AppShellProps = {
  /** The page title, shown in the header as the page's only h1. */
  title: string;
  /** Controls on the right of the header, such as the role switcher. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * The frame around every page: a skip link, a header with logo, title and the demo time, and
 * the main content. The demo time is always visible, so relative times like "Updated 2h ago"
 * make sense to anyone viewing the demo on a later day.
 */
export function AppShell({ title, actions, children }: AppShellProps) {
  const now = getNow().toISOString();
  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.logo} href="/">
            Throughline
          </Link>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.clock}>
            Demo time: <time dateTime={now}>{formatDayTime(now)}</time>
          </p>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </>
  );
}
