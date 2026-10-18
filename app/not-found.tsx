import { SearchX } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Shown for any URL that doesn't exist, and wherever a page calls notFound().
 * Next.js requires a default export here, so this is an exception to named exports.
 */
export default function NotFound() {
  return (
    <AppShell title="Page not found">
      <EmptyState
        icon={<SearchX size={32} strokeWidth={1.75} />}
        title="We couldn't find that page"
        message="The link may be out of date, or the page has moved."
        action={
          <ButtonLink href="/" variant="primary">
            Back to start
          </ButtonLink>
        }
      />
    </AppShell>
  );
}
