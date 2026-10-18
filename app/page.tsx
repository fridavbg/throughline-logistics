import { Inbox } from "lucide-react";
import { AiLabel } from "@/components/ai/AiLabel";
import { AiReason } from "@/components/ai/AiReason";
import { ConfidenceMeter } from "@/components/ai/ConfidenceMeter";
import { AppShell } from "@/components/layout/AppShell";
import { EtaStatusBadge } from "@/components/shipment/EtaStatusBadge";
import { SourceTag } from "@/components/shipment/SourceTag";
import { StatusBadge } from "@/components/shipment/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import styles from "./page.module.scss";

/**
 * Temporary preview of the base components, so the deployed site can be checked at
 * 360, 768 and 1280px (#10). The role picker (F1, #11) replaces this page.
 * Next.js requires a default export for pages, so this is an exception to named exports.
 */
export default function Home() {
  return (
    <AppShell title="Component preview">
      <div className={styles.grid}>
        <Card as="section">
          <h2 className={styles.heading}>Shipment status</h2>
          <div className={styles.row}>
            <StatusBadge status="planned" />
            <StatusBadge status="in_transit" mode="road" />
            <StatusBadge status="in_transit" mode="sea" />
            <StatusBadge status="at_port" />
            <StatusBadge status="customs_hold" />
            <StatusBadge status="delivered" />
          </div>
        </Card>

        <Card as="section">
          <h2 className={styles.heading}>ETA status and source</h2>
          <div className={styles.row}>
            <EtaStatusBadge status="on_time" />
            <EtaStatusBadge status="at_risk" />
            <EtaStatusBadge status="late" />
          </div>
          <div className={styles.row}>
            <SourceTag source="confirmed" />
            <SourceTag source="estimated" />
            <SourceTag source="ai_predicted" />
          </div>
        </Card>

        <Card as="section">
          <h2 className={styles.heading}>AI marker</h2>
          <div className={styles.row}>
            <AiLabel />
            <ConfidenceMeter confidence={0.86} />
            <ConfidenceMeter confidence={0.7} />
            <ConfidenceMeter confidence={0.45} />
          </div>
          <AiReason reason="Vessel departed 26h late from Valencia." />
        </Card>

        <Card as="section">
          <h2 className={styles.heading}>Buttons and dialog</h2>
          <div className={styles.row}>
            <Button variant="primary">Notify customer</Button>
            <Button>Request document</Button>
            <Button variant="ghost">Discard</Button>
          </div>
          <Dialog
            trigger={<Button variant="primary">Open dialog</Button>}
            title="Notify customer"
            description="Drafted by AI. Review before sending."
          >
            <p>The draft message goes here.</p>
          </Dialog>
        </Card>

        <Card as="section">
          <h2 className={styles.heading}>Loading</h2>
          <div className={styles.stack} aria-busy="true">
            <Skeleton width="40%" />
            <Skeleton height="var(--space-6)" />
            <Skeleton width="70%" />
          </div>
        </Card>

        <Card as="section">
          <EmptyState icon={<Inbox size={32} strokeWidth={1.75} />} title="Nothing needs attention right now." />
        </Card>
      </div>
    </AppShell>
  );
}
