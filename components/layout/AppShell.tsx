import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./AppShell.module.scss";

export type AppShellProps = {
  /** The page title, shown in the header as the page's only h1. */
  title: string;
  /** Controls on the right of the header, such as the role switcher. */
  actions?: ReactNode;
  children: ReactNode;
};

/** The frame around every page: a skip link, a header with logo and title, and the main content. */
export function AppShell({ title, actions, children }: AppShellProps) {
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
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </>
  );
}
