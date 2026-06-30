"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { categories, cities } from "@/lib/data/cars";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEur } from "@/lib/utils";

const PRICE_STEPS = [600, 800, 1300] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

const ANY = "any";

// Date inputs keep their own native field styling.
const DATE_FIELD =
  "h-12 w-full rounded-[var(--radius-md)] border border-border bg-surface px-4 " +
  "text-[0.95rem] text-foreground transition-colors focus:border-primary " +
  "focus:outline-none focus:ring-2 focus:ring-primary/15 cursor-pointer";

export function BookingHero({ startingPrice }: { startingPrice: number }) {
  const t = useT();
  const router = useRouter();

  const [location, setLocation] = useState("");
  const [pickup, setPickup] = useState("");
  const [ret, setRet] = useState("");
  const [category, setCategory] = useState("");
  const [max, setMax] = useState("");

  function onSearch() {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    if (pickup) params.set("pickup", pickup);
    if (ret) params.set("return", ret);
    if (category) params.set("category", category);
    if (max) params.set("max", max);
    const qs = params.toString();
    router.push(qs ? `/cars?${qs}` : "/cars");
  }

  return (
    <section className="mx-auto w-full max-w-[1400px] px-5 pb-16 pt-32 sm:px-8 md:pb-24 md:pt-44">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <div className="label-mono flex items-center gap-3 text-muted-foreground">
          <span className="h-px w-8 bg-border" />
          <span>{t.booking.kicker}</span>
        </div>

        <h1 className="font-display mt-6 max-w-3xl text-[clamp(2.75rem,9vw,7rem)] font-light leading-[0.95] tracking-[-0.03em]">
          {t.booking.titleA}{" "}
          <span className="italic text-primary">{t.booking.titleB}</span>
        </h1>

        {/* Search card */}
        <div className="mt-10 rounded-[var(--radius)] border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Pick-up location */}
            <div>
              <Label htmlFor="bk-location">{t.booking.location}</Label>
              <Select
                value={location || ANY}
                onValueChange={(v) => setLocation(v === ANY ? "" : v)}
              >
                <SelectTrigger id="bk-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t.booking.locationAny}</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pick-up date */}
            <div>
              <Label htmlFor="bk-pickup">{t.booking.pickup}</Label>
              <input
                id="bk-pickup"
                type="date"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className={DATE_FIELD}
              />
            </div>

            {/* Return date */}
            <div>
              <Label htmlFor="bk-return">{t.booking.return}</Label>
              <input
                id="bk-return"
                type="date"
                value={ret}
                min={pickup || undefined}
                onChange={(e) => setRet(e.target.value)}
                className={DATE_FIELD}
              />
            </div>

            {/* Car type */}
            <div>
              <Label htmlFor="bk-type">{t.booking.carType}</Label>
              <Select
                value={category || ANY}
                onValueChange={(v) => setCategory(v === ANY ? "" : v)}
              >
                <SelectTrigger id="bk-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t.booking.carTypeAny}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t.categories[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max price */}
            <div>
              <Label htmlFor="bk-max">{t.booking.maxPrice}</Label>
              <Select
                value={max || ANY}
                onValueChange={(v) => setMax(v === ANY ? "" : v)}
              >
                <SelectTrigger id="bk-max">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>{t.booking.priceAny}</SelectItem>
                  {PRICE_STEPS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {formatEur(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-baseline gap-2">
              <span className="label-mono text-muted-foreground">
                {t.booking.priceFrom}
              </span>
              <span className="font-display text-2xl tracking-tight">
                {formatEur(startingPrice)}
              </span>
              <span className="label-mono text-muted-foreground">
                {t.booking.perDay}
              </span>
            </p>
            <Button
              size="lg"
              variant="primary"
              className="group"
              onClick={onSearch}
            >
              {t.booking.search}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
