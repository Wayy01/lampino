"use client";

import { useRouter } from "next/navigation";
import OptionWheel from "./option-wheel";

export interface MobileNavItem {
  href: string;
  label: string;
}

/** Mobile-only nav menu: normal links followed by all categories, rendered as
 * a single scrollable/draggable OptionWheel list that navigates on selection. */
export function MobileNavMenu({
  items,
  onNavigate,
}: {
  items: MobileNavItem[];
  onNavigate: () => void;
}) {
  const router = useRouter();

  return (
    <div className="font-display h-[min(56vh,380px)]">
      <OptionWheel
        items={items.map((item) => item.label)}
        defaultSelected={0}
        textColor="var(--muted-foreground)"
        activeColor="var(--foreground)"
        side="left"
        fontSize={1.6}
        spacing={1.5}
        curve={1}
        tilt={9}
        blur={1.5}
        fade={0.3}
        inset={4}
        smoothing={180}
        onChange={(index) => {
          const item = items[index];
          if (!item) return;
          onNavigate();
          router.push(item.href);
        }}
      />
    </div>
  );
}
