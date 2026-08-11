"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { AdminSelect, type AdminSelectOption } from "@/components/admin/select";

function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page"); // any filter change resets pagination
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
}

/** Debounced text search bound to the `q` query param. */
export function SearchInput({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const setParams = useParamSetter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ q: next.trim() }), 350);
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[var(--radius-md)] border bg-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
      />
    </div>
  );
}

/** The shared dropdown bound to a query param. */
export function FilterSelect({
  param,
  options,
  allLabel,
  className,
}: {
  param: string;
  options: AdminSelectOption[];
  allLabel: string;
  className?: string;
}) {
  const setParams = useParamSetter();
  const searchParams = useSearchParams();

  return (
    <AdminSelect
      value={searchParams.get(param) ?? ""}
      onValueChange={(value) => setParams({ [param]: value })}
      options={[{ value: "", label: allLabel }, ...options]}
      ariaLabel={allLabel}
      className={cn("w-auto min-w-[10rem] bg-surface", className)}
    />
  );
}

/** Prev / next pager driven by the `page` query param. */
export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useAdminT();
  if (totalPages <= 1) return null;

  const go = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const btn =
    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border transition-colors hover:bg-foreground/[0.04] disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs text-muted-foreground">
        {page} / {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label={t.common.previousPage}
          className={btn}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          aria-label={t.common.nextPage}
          className={btn}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
