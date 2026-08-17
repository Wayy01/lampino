"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/data/products";
import type { ProductVariant } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart/provider";
import { track } from "@/lib/analytics/track";
import { formatPrice, pick, cn } from "@/lib/utils";
import { productHref } from "@/lib/i18n/routing";
import { specList, specValue } from "@/lib/specs";

const IMAGE_PLACEHOLDER =
  "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&q=80";

/**
 * Enclosed product tile — a bordered surface rather than the bare stacked
 * layout of the other two cards.
 *
 * Every region has a reserved height so a product with eight long variant
 * names occupies exactly as much space as one with none: the name clamps to
 * two lines, the spec line to one, and the variants sit in a fixed-height
 * strip that scrolls sideways instead of wrapping.
 */
export function ProductCardTile({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const { lang, t } = useLang();
  const { addItem, openCart } = useCart();

  const name = pick(lang, product.name_ro, product.name_ru);
  const image = product.images[0]?.imageUrl ?? IMAGE_PLACEHOLDER;
  const category = product.category
    ? pick(lang, product.category.name_ro, product.category.name_ru)
    : "";

  const chips = specList(product.specifications)
    .map(([id, entry]) => ({ id, value: specValue(entry, lang) }))
    .filter((c) => c.value)
    .slice(0, 2);

  // Same selection rules as the detail page, so a card and the page it links to
  // never disagree about which variant is showing.
  const variants = useMemo(
    () => [...product.variants].sort((a, b) => a.sortOrder - b.sortOrder),
    [product.variants],
  );
  const hasVariants = product.hasVariants && variants.length > 0;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants ? (variants.find((v) => v.isDefault) ?? variants[0]) : null,
  );

  const unitPrice = selectedVariant?.price ?? product.price;
  const stock = selectedVariant?.stock ?? product.stock;
  const reduced = selectedVariant
    ? selectedVariant.reducedPrice
    : product.reducedPrice;
  const hasDiscount = reduced !== null && reduced < unitPrice;
  const displayPrice = hasDiscount ? reduced! : unitPrice;
  const discountPercent = hasDiscount
    ? Math.round((1 - displayPrice / unitPrice) * 100)
    : 0;

  const handleAdd = () => {
    addItem(product, selectedVariant ? { variant: selectedVariant } : undefined);
    track({ type: "add_to_cart", productId: product.id });
    openCart();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: (index % 4) * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]"
    >
      <Link
        href={productHref(lang, product.id, product.name_ro)}
        className="block shrink-0"
        aria-label={name}
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          />
          {hasDiscount && (
            <span className="label-mono absolute left-2 top-2 rounded-[var(--radius-sm)] bg-primary px-1.5 py-0.5 text-[0.625rem] leading-4 text-primary-foreground shadow-sm">
              −{discountPercent}%
            </span>
          )}
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        {/* Reserved single line — keeps the name baseline identical whether or
            not a product is filed under a category. */}
        <div className="label-mono h-4 truncate text-[0.625rem] leading-4 text-muted-foreground sm:text-[0.6875rem]">
          {category}
        </div>

        <Link
          href={productHref(lang, product.id, product.name_ro)}
          className="min-w-0"
        >
          <h3 className="font-display line-clamp-2 h-[2lh] text-[0.9375rem] leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-base">
            {name}
          </h3>
        </Link>

        {/* Reserved single line, always present so the price row never shifts. */}
        <div className="mt-1 flex h-4 min-w-0 items-center gap-x-1.5 truncate text-[0.6875rem] leading-4 text-muted-foreground">
          {chips.map((chip, i) => (
            <span key={chip.id} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span
                  className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/50"
                  aria-hidden
                />
              )}
              <span className="truncate">{chip.value}</span>
            </span>
          ))}
        </div>

        {/* Fixed-height, non-wrapping strip: any number of variants with any
            label length costs the same vertical space. */}
        {hasVariants && (
          <div
            role="group"
            aria-label={t.product.selectVariant}
            className="no-scrollbar mt-2 flex h-7 shrink-0 snap-x snap-mandatory items-center gap-1 overflow-x-auto overflow-y-hidden"
          >
            {variants.map((v) => {
              const label = [pick(lang, v.name_ro, v.name_ru), v.size]
                .filter(Boolean)
                .join(" · ");
              const isSelected = selectedVariant?.id === v.id;
              const soldOut = v.stock <= 0;
              return (
                <Button
                  key={v.id}
                  variant="bare"
                  size="none"
                  pill
                  aria-pressed={isSelected}
                  disabled={soldOut}
                  onClick={() => setSelectedVariant(v)}
                  title={label}
                  className={cn(
                    "h-6 max-w-[7rem] shrink-0 snap-start truncate border px-2 text-[0.6875rem] leading-6 transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    soldOut &&
                      "cursor-not-allowed line-through opacity-40 hover:border-border hover:text-muted-foreground",
                  )}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Pinned to the bottom so buttons align across a grid row. */}
        <div className="mt-auto pt-2.5">
          <div className="flex h-6 min-w-0 items-baseline gap-x-1.5 overflow-hidden">
            <span
              className={cn(
                "font-display shrink-0 text-base leading-6 tracking-tight sm:text-lg",
                hasDiscount && "text-primary",
              )}
            >
              {formatPrice(displayPrice)}
            </span>
            {hasDiscount && (
              <span className="shrink-0 text-[0.6875rem] text-muted-foreground line-through">
                {formatPrice(unitPrice)}
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="none"
            disabled={stock <= 0}
            onClick={handleAdd}
            className="mt-2 h-9 w-full gap-1.5 rounded-[var(--radius)] px-2 text-[0.6875rem] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <ShoppingBag className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">
              {stock > 0 ? t.cart.add : t.product.outOfStock}
            </span>
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
