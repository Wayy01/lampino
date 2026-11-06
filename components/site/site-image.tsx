"use client";

import type { ComponentProps } from "react";
import { ResilientImage } from "@/components/ui/resilient-image";
import { useT } from "@/lib/i18n/provider";

/** Storefront image: `ResilientImage` with the storefront's strings. */
export function SiteImage(props: Omit<ComponentProps<typeof ResilientImage>, "labels">) {
  return <ResilientImage labels={useT().image} {...props} />;
}
