import { AppShell } from "@/components/layout/AppShell";
import { PersonaPicker } from "@/components/layout/PersonaPicker";
import styles from "./page.module.scss";

/**
 * The demo login (F1): pick a persona to enter the app. There's no real authentication.
 * Next.js requires a default export for pages, so this is an exception to named exports.
 */
export default function Home() {
  return (
    <AppShell title="Choose a persona">
      <p className={styles.intro}>
        Throughline is a prototype for tracking shipments across sites, operators, road and sea.
        Pick a persona to see the app as them. All companies, people and shipments are invented.
      </p>
      <PersonaPicker />
    </AppShell>
  );
}
