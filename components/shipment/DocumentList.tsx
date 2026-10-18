import { FileCheck, FileWarning } from "lucide-react";
import { DOCUMENT_NAMES } from "@/lib/exceptions";
import type { ShipmentDocument } from "@/lib/types";
import styles from "./DocumentList.module.scss";

export type DocumentListProps = {
  documents: ShipmentDocument[];
};

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true };

/** The shipment's paperwork, each one on file or missing. Icon and words both say which. */
export function DocumentList({ documents }: DocumentListProps) {
  return (
    <section aria-labelledby="documents-heading" className={styles.panel}>
      <h2 id="documents-heading" className={styles.heading}>
        Documents
      </h2>
      {documents.length === 0 ? (
        <p className={styles.empty}>No documents for this shipment.</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((doc) => (
            <li key={doc.type} className={`${styles.item} ${styles[doc.status]}`}>
              {doc.status === "available" ? <FileCheck {...ICON} /> : <FileWarning {...ICON} />}
              <span className={styles.name}>{capitalize(DOCUMENT_NAMES[doc.type])}</span>
              <span className={styles.status}>{doc.status === "available" ? "On file" : "Missing"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "packing list" → "Packing list". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
