"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { ExceptionRow } from "@/components/shipment/ExceptionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { customers, sites } from "@/data/seed";
import { visibleShipments } from "@/lib/access";
import { EXCEPTION_LABELS } from "@/lib/ai/triage";
import { filterInbox, inboxItems, NO_FILTER, type InboxFilter } from "@/lib/inbox";
import { useCurrentUser, useDemoStore, useShipments } from "@/lib/store";
import { getNow } from "@/lib/time";
import type { ExceptionType } from "@/lib/types";
import styles from "./AttentionInbox.module.scss";

const TYPES = Object.keys(EXCEPTION_LABELS) as ExceptionType[]; // keys of a Record<ExceptionType, …>: exactly the union

/**
 * The ops home (F2): what needs action, most urgent first, within the persona's sites.
 * Filters narrow the list; handled items leave it.
 */
export function AttentionInbox() {
  const user = useCurrentUser();
  const allShipments = useShipments();
  const handledIds = useDemoStore((state) => state.handledIds);
  const [filter, setFilter] = useState<InboxFilter>(NO_FILTER);
  if (!user) return null;

  const now = getNow();
  const visible = visibleShipments(user, allShipments);
  const items = inboxItems(visible, customers, sites, handledIds, now);
  const shown = filterInbox(items, filter);
  const siteOptions = sites.filter((site) => visible.some((s) => s.originSiteId === site.id));

  if (items.length === 0) {
    return <EmptyState icon={<CircleCheck size={32} strokeWidth={1.75} />} title="Nothing needs attention right now." />;
  }

  return (
    <section aria-labelledby="inbox-heading" className={styles.inbox}>
      <div className={styles.bar}>
        <h2 id="inbox-heading" className={styles.heading} aria-live="polite">
          {shown.length} need{shown.length === 1 ? "s" : ""} attention
        </h2>
        <div className={styles.filters}>
          <label className={styles.filter}>
            Type
            <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: toType(e.target.value) })}>
              <option value="all">All types</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {EXCEPTION_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          {siteOptions.length > 1 && (
            <label className={styles.filter}>
              Site
              <select value={filter.siteId} onChange={(e) => setFilter({ ...filter, siteId: e.target.value })}>
                <option value="all">All sites</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<CircleCheck size={32} strokeWidth={1.75} />} title="Nothing matches these filters." />
      ) : (
        <ol className={styles.list}>
          {shown.map((item) => (
            <li key={item.exception.id}>
              <ExceptionRow item={item} now={now} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The select's value back as a filter type, without trusting the DOM. */
function toType(value: string): InboxFilter["type"] {
  return TYPES.find((type) => type === value) ?? "all";
}
