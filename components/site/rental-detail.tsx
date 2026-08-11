"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowLeft, Check, MessageCircle, Phone, FileText } from "lucide-react";
import type {
  ContactInfo,
  MediaItem,
  RentalPackage,
  RentalPackageVariant,
} from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { rentalsHref } from "@/lib/i18n/routing";
import { pick, formatPrice, cn } from "@/lib/utils";
import { specList, specLabel, specValue } from "@/lib/specs";
import { ProductGallery } from "./product-gallery";
import { RentalInquiryDrawer } from "./rental-inquiry-drawer";

const EASE = [0.22, 1, 0.36, 1] as const;

export function RentalDetail({
  pkg,
  contact,
}: {
  pkg: RentalPackage;
  contact: ContactInfo | null;
}) {
  const { lang, t } = useLang();

  const title = pick(lang, pkg.title_ro, pkg.title_ru);
  const description = pick(lang, pkg.description_ro, pkg.description_ru);
  const includes = pick(lang, pkg.includes_ro, pkg.includes_ru);
  const specs = specList(pkg.specifications);

  const variants = useMemo(
    () => [...pkg.variants].sort((a, b) => a.sortOrder - b.sortOrder),
    [pkg.variants],
  );
  const hasVariants = pkg.hasVariants && variants.length > 0;

  const [selected, setSelected] = useState<RentalPackageVariant | null>(
    hasVariants ? (variants.find((v) => v.isDefault) ?? variants[0]) : null,
  );
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const activePrice = selected ? selected.price : pkg.price;
  const activeReduced = selected ? selected.reducedPrice : pkg.reducedPrice;
  const hasReduced = activeReduced != null && activeReduced < activePrice;
  const shownPrice = hasReduced ? activeReduced! : activePrice;

  // Videos first, then images.
  const media: MediaItem[] = useMemo(
    () => [
      ...pkg.videos.map((v) => ({
        type: "video" as const,
        src: v.videoUrl,
        thumbnail: v.thumbnailUrl,
      })),
      ...pkg.images.map((i) => ({ type: "image" as const, src: i.imageUrl })),
    ],
    [pkg.videos, pkg.images],
  );
  // Featured media next to the title: prefer a video (autoplaying), else the
  // first image, else a warm gradient placeholder.
  const heroVideo = pkg.videos[0];
  const heroImage = pkg.images[0]?.imageUrl;
  const showGallery = media.length > 1;

  const variantLabel = selected
    ? [pick(lang, selected.name_ro, selected.name_ru), selected.size]
        .filter(Boolean)
        .join(" · ")
    : null;

  const waNumber = contact?.whatsapp.replace(/[^\d]/g, "") ?? "";
  const waMessage = encodeURIComponent(
    `${t.rental.whatsappIntro} ${title}${variantLabel ? ` (${variantLabel})` : ""}`,
  );
  const waHref = `https://wa.me/${waNumber}?text=${waMessage}`;

  return (
    <div className="pb-28 pt-24 md:pt-28">
      {/* Back link */}
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Link
            href={rentalsHref(lang)}
            className="group label-mono inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            {t.rental.back}
          </Link>
        </motion.div>
      </div>

      {/* Editorial hero — text + featured image, framed differently from products */}
      <section className="mx-auto mt-8 max-w-[1400px] px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="font-display text-[clamp(2.5rem,6.5vw,5rem)] font-light leading-[0.95] tracking-[-0.03em]"
            >
              {title}
            </motion.h1>

            {/* Good-for chips */}
            <div className="mt-10">
              <div className="label-mono mb-3 text-muted-foreground">
                {t.arenda.goodForTitle}
              </div>
              <div className="flex flex-wrap gap-2">
                {t.arenda.goodFor.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-foreground/80"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Featured shot */}
          <motion.div
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-muted sm:aspect-[5/4] lg:aspect-[4/5]"
          >
            {heroVideo ? (
              <video
                src={heroVideo.videoUrl}
                poster={heroVideo.thumbnailUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : heroImage ? (
              <Image
                src={heroImage}
                alt={title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-accent via-muted to-background" />
            )}
            <div className="absolute inset-0 ring-1 ring-inset ring-foreground/10" />
          </motion.div>
        </div>
      </section>

      {/* Body: content + sticky inquiry aside */}
      <section className="mx-auto mt-16 max-w-[1400px] px-5 sm:px-8 md:mt-24">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          {/* Main column */}
          <div className="min-w-0">
            {/* About — the package description, moved out of the hero */}
            {description && (
              <div className="mb-14">
                <div className="label-mono mb-6 flex items-center gap-3 text-muted-foreground">
                  <span className="h-px w-8 bg-border" />
                  {t.rental.overview}
                </div>
                <p className="max-w-2xl text-lg leading-relaxed text-foreground/85 md:text-xl">
                  {description}
                </p>
              </div>
            )}

            {/* What's included */}
            {includes.length > 0 && (
              <div>
                <div className="label-mono mb-6 flex items-center gap-3 text-muted-foreground">
                  <span className="h-px w-8 bg-border" />
                  {t.rental.includes}
                </div>
                <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                      <span className="text-[0.975rem] leading-snug text-foreground/90">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Technical details */}
            {specs.length > 0 && (
              <div className="mt-14">
                <div className="label-mono mb-6 flex items-center gap-3 text-muted-foreground">
                  <span className="h-px w-8 bg-border" />
                  {t.rental.specs}
                </div>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-4">
                  {specs.map(([id, entry]) => (
                    <div key={id} className="bg-surface p-5">
                      <div className="label-mono text-muted-foreground">
                        {specLabel(entry, lang)}
                      </div>
                      <div className="font-display mt-2 text-xl tracking-tight">
                        {specValue(entry, lang)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {showGallery && (
              <div className="mt-14">
                <div className="label-mono mb-6 flex items-center gap-3 text-muted-foreground">
                  <span className="h-px w-8 bg-border" />
                  {t.rental.gallery}
                </div>
                <ProductGallery media={media} alt={title} />
              </div>
            )}
          </div>

          {/* Sticky inquiry aside — no cart, no stock: request-a-quote flow */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
              <div className="bg-accent/60 p-6 md:p-7">
                <div className="label-mono text-accent-foreground">
                  {t.rental.from}
                </div>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span className="font-display text-4xl tracking-tight">
                    {formatPrice(shownPrice)}
                  </span>
                  {hasReduced && (
                    <span className="text-base text-muted-foreground line-through">
                      {formatPrice(activePrice)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">
                  {t.rental.priceNote}
                </p>
              </div>

              <div className="p-6 md:p-7">
                {/* Variant tiers */}
                {hasVariants && (
                  <div className="mb-6">
                    <div className="label-mono mb-3 text-muted-foreground">
                      {t.rental.selectOption}
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {variants.map((v) => {
                        const label = pick(lang, v.name_ro, v.name_ru);
                        const isSelected = selected?.id === v.id;
                        const vReduced =
                          v.reducedPrice != null && v.reducedPrice < v.price;
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelected(v)}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary/[0.06]"
                                : "border-border hover:border-foreground/30",
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  isSelected
                                    ? "border-primary"
                                    : "border-foreground/30",
                                )}
                              >
                                {isSelected && (
                                  <span className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </span>
                              <span className="text-sm font-medium">
                                {label}
                                {v.size ? (
                                  <span className="text-muted-foreground">
                                    {" · "}
                                    {v.size}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="font-display shrink-0 text-base tracking-tight">
                              {formatPrice(vReduced ? v.reducedPrice! : v.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Primary CTA — opens the rental request form (RentalApplication) */}
                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="inline-flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] bg-primary text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <FileText className="h-5 w-5" strokeWidth={1.75} />
                  {t.rental.requestQuote}
                </button>

                {(contact?.whatsapp || contact?.phone) && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {contact?.whatsapp && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-foreground/15 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03]"
                      >
                        <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                        {t.rental.whatsapp}
                      </a>
                    )}
                    {contact?.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-foreground/15 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03]"
                      >
                        <Phone className="h-4 w-4" strokeWidth={1.75} />
                        {t.rental.callUs}
                      </a>
                    )}
                  </div>
                )}

                {/* Perks */}
                <ul className="mt-7 space-y-3 border-t border-border pt-6">
                  {t.rental.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-center gap-3 text-sm text-foreground/90"
                    >
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-24 max-w-[1400px] px-5 sm:px-8 md:mt-32">
        <div className="rounded-[var(--radius-lg)] border border-border bg-foreground px-6 py-14 text-background sm:px-10 md:px-14 md:py-20">
          <div className="label-mono flex items-center gap-3 text-background/60">
            <span className="h-px w-8 bg-background/30" />
            {t.rental.howKicker}
          </div>
          <h2 className="font-display mt-4 max-w-2xl text-[clamp(1.9rem,4.5vw,3.25rem)] font-light leading-[1.02] tracking-[-0.02em]">
            {t.rental.howTitle}
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {t.rental.steps.map((step, i) => (
              <div key={i} className="border-t border-background/20 pt-6">
                <div className="font-display text-3xl text-background/40">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-display mt-4 text-xl tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-background/70">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RentalInquiryDrawer
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        pkg={pkg}
        variant={selected}
      />
    </div>
  );
}
