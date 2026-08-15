"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ShoppingBag,
  Zap,
  Check,
  MessageCircle,
  Phone,
  Minus,
  Plus,
} from "lucide-react";
import type { Product } from "@/lib/data/products";
import type { ContactInfo, MediaItem, ProductVariant } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { shopHref } from "@/lib/i18n/routing";
import { useCart } from "@/lib/cart/provider";
import { track } from "@/lib/analytics/track";
import { specList, specLabel, specValue } from "@/lib/specs";
import { formatPrice, pick, cn } from "@/lib/utils";
import { ProductGallery } from "./product-gallery";
import { FastBuyDrawer } from "./fast-buy-drawer";
import { Button } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ProductDetail({
  product,
  contact,
}: {
  product: Product;
  contact: ContactInfo | null;
}) {
  const { lang, t } = useLang();
  const { addItem, openCart } = useCart();

  const name = pick(lang, product.name_ro, product.name_ru);

  const variants = useMemo(
    () => [...product.variants].sort((a, b) => a.sortOrder - b.sortOrder),
    [product.variants],
  );
  const hasVariants = product.hasVariants && variants.length > 0;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants
      ? (variants.find((v) => v.isDefault) ?? variants[0])
      : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [fastBuyOpen, setFastBuyOpen] = useState(false);

  const unitPrice = selectedVariant?.price ?? product.price;
  const stock = selectedVariant?.stock ?? product.stock;
  const inStock = stock > 0;

  const reduced = selectedVariant
    ? selectedVariant.reducedPrice
    : product.reducedPrice;
  const hasDiscount = reduced !== null && reduced < unitPrice;
  const finalPrice = hasDiscount ? reduced! : unitPrice;

  // Videos always come first, then images.
  const media: MediaItem[] = useMemo(
    () => [
      ...product.videos.map((v) => ({
        type: "video" as const,
        src: v.videoUrl,
        thumbnail: v.thumbnailUrl,
      })),
      ...product.images.map((i) => ({
        type: "image" as const,
        src: i.imageUrl,
      })),
    ],
    [product.videos, product.images],
  );

  // Specs are free-form and bilingual — render whatever the product carries.
  const specs = specList(product.specifications).map(([id, entry]) => ({
    id,
    label: specLabel(entry, lang),
    value: specValue(entry, lang),
  }));

  const selectVariant = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, variant.stock)));
  };

  const changeQuantity = (delta: number) => {
    setQuantity((q) => Math.min(Math.max(1, q + delta), Math.max(1, stock)));
  };

  const waNumber = contact?.whatsapp.replace(/[^\d]/g, "") ?? "";
  const variantLabel = selectedVariant
    ? [pick(lang, selectedVariant.name_ro, selectedVariant.name_ru), selectedVariant.size]
        .filter(Boolean)
        .join(" · ")
    : null;
  const waMessage = encodeURIComponent(
    `${t.product.whatsappIntro} ${name}${variantLabel ? ` (${variantLabel})` : ""}`,
  );

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <Link
          href={shopHref(lang)}
          className="group label-mono inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {t.product.back}
        </Link>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-mono text-primary">
            {product.category
              ? pick(lang, product.category.name_ro, product.category.name_ru)
              : ""}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-display mt-3 text-[clamp(2.25rem,6vw,4.5rem)] font-light leading-[0.95] tracking-[-0.03em]"
          >
            {name}
          </motion.h1>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
        {/* Left: gallery + overview + specs */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          >
            <ProductGallery media={media} alt={name} />
          </motion.div>

          <div className="mt-14">
            <div className="label-mono mb-5 text-muted-foreground">
              {t.product.overview}
            </div>
            <p className="font-display max-w-xl text-2xl font-light leading-snug tracking-tight md:text-3xl">
              {pick(lang, product.description_ro, product.description_ru)}
            </p>
          </div>

          {specs.length > 0 && (
            <div className="mt-14">
              <div className="label-mono mb-6 text-muted-foreground">
                {t.product.specs}
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-3">
                {specs.map((s) => (
                  <div key={s.id} className="flex flex-col gap-1.5 bg-background p-5">
                    <div className="label-mono text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="font-medium leading-snug">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: sticky order panel */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 md:p-7">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span
                className={cn(
                  "font-display text-4xl tracking-tight",
                  hasDiscount && "text-primary",
                )}
              >
                {formatPrice(finalPrice)}
              </span>
              {hasDiscount && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(unitPrice)}
                </span>
              )}
            </div>

            {/* Stock */}
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  inStock ? "bg-primary" : "bg-muted-foreground/50",
                )}
              />
              <span className={inStock ? "text-foreground" : "text-muted-foreground"}>
                {inStock ? `${t.product.inStock} · ${stock} ${t.product.stockLeft}` : t.product.outOfStock}
              </span>
            </div>

            {/* Variants */}
            {hasVariants && (
              <div className="mt-6">
                <div className="label-mono mb-3 text-muted-foreground">
                  {t.product.selectVariant}
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const label = [pick(lang, v.name_ro, v.name_ru), v.size]
                      .filter(Boolean)
                      .join(" · ");
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => selectVariant(v)}
                        disabled={v.stock <= 0}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mt-6 flex items-center justify-between">
              <span className="label-mono text-muted-foreground">
                {t.product.quantity}
              </span>
              <div className="flex items-center gap-1 rounded-full border border-border">
                <button
                  onClick={() => changeQuantity(-1)}
                  disabled={quantity <= 1}
                  aria-label={t.cart.remove}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-7 text-center text-sm font-medium tabular-nums">
                  {quantity}
                </span>
                <button
                  onClick={() => changeQuantity(1)}
                  disabled={quantity >= stock}
                  aria-label={t.cart.add}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Primary actions */}
            <Button
              size="lg"
              className="group mt-6 w-full"
              disabled={!inStock}
              onClick={() => {
                addItem(product, { variant: selectedVariant, quantity });
                track({ type: "add_to_cart", productId: product.id });
                openCart();
              }}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
              {t.cart.add}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="mt-3 w-full"
              disabled={!inStock}
              onClick={() => setFastBuyOpen(true)}
            >
              <Zap className="h-5 w-5" strokeWidth={1.75} />
              {t.product.buyNow}
            </Button>

            {/* Contact actions */}
            {(contact?.whatsapp || contact?.phone) && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {contact?.whatsapp && (
                  <a
                    href={`https://wa.me/${waNumber}?text=${waMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-foreground/15 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03]"
                  >
                    <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                    {t.product.whatsapp}
                  </a>
                )}
                {contact?.phone && (
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-foreground/15 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03]"
                  >
                    <Phone className="h-4 w-4" strokeWidth={1.75} />
                    {t.product.callUs}
                  </a>
                )}
              </div>
            )}

            <ul className="mt-7 space-y-3 border-t border-border pt-6">
              {t.product.includedItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <FastBuyDrawer
        open={fastBuyOpen}
        onOpenChange={setFastBuyOpen}
        product={product}
        variant={selectedVariant}
        quantity={quantity}
      />
    </div>
  );
}
