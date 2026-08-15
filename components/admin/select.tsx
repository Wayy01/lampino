"use client";

import { useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminSelectOption = {
  value: string;
  label: React.ReactNode;
};

// Radix items can't carry an empty-string value, so "empty" options (e.g.
// "No category") use a sentinel internally; the hidden input submits "".
const EMPTY = "__empty__";

/**
 * The one dropdown used across the admin: themed trigger and menu (never the
 * OS-native popup), keyboard and touch friendly. Posts its value through a
 * plain hidden input, so it drops into any server-action form.
 */
export function AdminSelect({
  name,
  options,
  defaultValue = "",
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  id,
  className,
}: {
  name?: string;
  options: AdminSelectOption[];
  defaultValue?: string;
  /** Controlled mode; leave undefined for uncontrolled forms. */
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value !== undefined ? value : internal;

  const handleChange = (next: string) => {
    const mapped = next === EMPTY ? "" : next;
    if (value === undefined) setInternal(mapped);
    onValueChange?.(mapped);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <SelectPrimitive.Root
        value={current === "" ? EMPTY : current}
        onValueChange={handleChange}
      >
        <SelectPrimitive.Trigger
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-md)] border bg-background pl-3 pr-2.5 text-sm outline-none transition-colors focus:border-primary data-[placeholder]:text-muted-foreground",
            className,
          )}
        >
          <span className="min-w-0 truncate text-left">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="cs-select-content z-[100] max-h-[min(18rem,var(--radix-select-content-available-height))] w-max min-w-[var(--radix-select-trigger-width)] max-w-[min(20rem,90vw)] overflow-hidden rounded-[var(--radius-md)] border bg-surface shadow-lg"
          >
            <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value || EMPTY}
                  value={option.value === "" ? EMPTY : option.value}
                  className="flex cursor-pointer select-none items-center justify-between gap-2 whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-muted data-[state=checked]:text-primary"
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </>
  );
}
