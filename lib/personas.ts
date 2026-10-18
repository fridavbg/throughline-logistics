/**
 * How a demo persona is described and where it lands after login. Spec: docs/PRD.md §F1.
 */
import type { Customer, Site, User } from "@/lib/types";

/** The start page for each role: the attention inbox for ops, "My shipments" for customers. */
export function homePath(role: User["role"]): "/ops" | "/customer" {
  switch (role) {
    case "customer":
      return "/customer";
    case "ops":
      return "/ops";
    default: {
      // Adding a role without a home page here fails to compile.
      const unhandled: never = role;
      throw new Error(`Unhandled user role: ${String(unhandled)}`);
    }
  }
}

/**
 * Where to send someone who opens a page meant for `pageRole`: to the picker with no
 * persona, to their own home with another role, or nowhere (null) when the page is theirs.
 * Without `pageRole` the page is for every role, such as the shared shipment detail.
 */
export function redirectFor(user: User | undefined, pageRole?: User["role"]): string | null {
  if (!user) return "/";
  if (pageRole !== undefined && user.role !== pageRole) return homePath(user.role);
  return null;
}

/** The role in words, e.g. "Support lead" for an ops user who sees every site. */
export function roleLabel(user: User): string {
  switch (user.role) {
    case "customer":
      return "Customer";
    case "ops":
      return user.siteIds === "all" ? "Support lead" : "Operations";
    default: {
      const unhandled: never = user;
      throw new Error(`Unhandled user role: ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * What the persona can see, in words: the customer's name, the ops user's sites, or
 * "All sites". An id missing from the reference data is shown as the id itself, so a
 * typo in the seed is visible instead of silently dropped.
 */
export function perimeterLabel(user: User, sites: Site[], customers: Customer[]): string {
  switch (user.role) {
    case "customer":
      return customers.find((c) => c.id === user.customerId)?.name ?? user.customerId;
    case "ops":
      if (user.siteIds === "all") return "All sites";
      return user.siteIds.map((id) => sites.find((s) => s.id === id)?.name ?? id).join(", ");
    default: {
      const unhandled: never = user;
      throw new Error(`Unhandled user role: ${JSON.stringify(unhandled)}`);
    }
  }
}
