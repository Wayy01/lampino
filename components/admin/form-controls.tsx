"use client";

import { useFormStatus } from "react-dom";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminLang } from "@/lib/admin/i18n-provider";

const inputClass =
  "h-10 w-full rounded-[var(--radius-md)] border bg-background px-3 text-sm outline-none transition-colors focus:border-primary disabled:opacity-50";

/** Label + control wrapper; the only way fields are laid out in the admin. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="label-mono block text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      rows={4}
      {...props}
      className={cn(
        inputClass,
        "h-auto min-h-[6rem] py-2 leading-relaxed",
        props.className,
      )}
    />
  );
}

/**
 * Hidden field carrying the active admin locale, so server actions can
 * translate errors and build locale-aware redirects. Include in every form.
 */
export function LangField() {
  const { lang } = useAdminLang();
  return <input type="hidden" name="_lang" value={lang} />;
}

/** Checkbox rendered as a switch; posts "on" like a plain checkbox. */
export function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-foreground/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:shadow after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4" />
      <span className="text-sm">{label}</span>
    </label>
  );
}

/** Submit button with pending spinner, for use inside a <form>. */
export function SubmitButton({
  children,
  className,
  variant = "ink",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "ink" | "primary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
        variant === "ink"
          ? "bg-foreground text-background hover:bg-foreground/90"
          : "bg-primary text-primary-foreground hover:bg-primary-hover",
        className,
      )}
    >
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export type ActionState = { ok?: boolean; error?: string } | null;

/** Inline result line rendered under a form after a server action returns. */
export function ActionNotice({ state }: { state: ActionState }) {
  const { t } = useAdminLang();
  if (!state?.ok && !state?.error) return null;
  return state.error ? (
    <p className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-sm text-red-700">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      {state.error}
    </p>
  ) : (
    <p className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      <Check className="h-4 w-4 shrink-0" />
      {t.common.saved}
    </p>
  );
}
