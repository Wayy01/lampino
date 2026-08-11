"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { login, type LoginState } from "@/lib/admin/actions/auth";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { LangField } from "@/components/admin/form-controls";

export function LoginForm() {
  const t = useAdminT();
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      action={action}
      className="rounded-[var(--radius)] border bg-surface p-6 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]"
    >
      <LangField />
      <label className="block">
        <span className="label-mono text-muted-foreground">
          {t.login.username}
        </span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border bg-background px-3 text-[0.95rem] outline-none transition-colors focus:border-primary"
        />
      </label>

      <label className="mt-4 block">
        <span className="label-mono text-muted-foreground">
          {t.login.password}
        </span>
        <div className="relative mt-1.5">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-11 w-full rounded-[var(--radius-md)] border bg-background px-3 pr-11 text-[0.95rem] outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t.login.hide : t.login.show}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </label>

      {state?.error && (
        <p className="mt-4 rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] bg-foreground text-[0.95rem] font-medium text-background transition-colors hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {t.login.signIn}
      </button>
    </form>
  );
}
