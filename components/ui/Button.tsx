import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./Button.module.scss";

/** How much a button stands out: one primary action per view, the rest secondary or ghost. */
export type ButtonVariant = "primary" | "secondary" | "ghost";

/** A native button, so it keeps keyboard and form behaviour. Icons go inside as children. */
export type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

/** A button with a 44px touch target. Defaults to `type="button"` so it never submits a form by accident. */
export function Button({ variant = "secondary", type = "button", className, ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, className)} {...rest} />;
}

/** A link that navigates like a link but looks like a {@link Button}, e.g. "Back to start". */
export type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant };

/** A Next.js link styled as a button, for actions that go to another page. */
export function ButtonLink({ variant = "secondary", className, ...rest }: ButtonLinkProps) {
  return <Link className={classes(variant, className)} {...rest} />;
}

function classes(variant: ButtonVariant, className: string | undefined): string {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}
