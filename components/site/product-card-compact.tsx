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
 * Compact variant of {@link ProductCard}, built for two-up on phones: nothing
 * floats over the image, every value has its own row, and the action block is
 * pushed to the bottom so buttons line up across a grid row whether or not a
 * product carries variants.
 */
export function ProductCardCompact({
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

  // Two at-a-glance values only — the detail page carries the full table.
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: (index % 4) * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group flex h-full min-w-0 flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1"
    >
      <Link
        href={productHref(lang, product.id, product.name_ro)}
        className="flex min-w-0 flex-col"
      >
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-muted">
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
          />
        </div>

        {category && (
          <div className="label-mono mt-2.5 truncate text-[0.625rem] text-muted-foreground sm:text-[0.6875rem]">
            {category}
          </div>
        )}

        <h3 className="font-display mt-1 line-clamp-2 min-h-[2lh] min-w-0 text-[0.9375rem] leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-lg">
          {name}
        </h3>

        {chips.length > 0 && (
          <div className="mt-1 flex min-w-0 items-center gap-x-2 truncate text-[0.6875rem] text-muted-foreground sm:text-xs">
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
        )}
      </Link>

      {/* Everything below is outside the link so taps land on the control, not
          the card. `mt-auto` keeps the buttons aligned across a grid row. */}
      <div className="mt-auto pt-2.5">
        {hasVariants && (
          <div
            role="group"
            aria-label={t.product.selectVariant}
            className="mb-2 flex flex-wrap gap-1"
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
                    "min-w-0 max-w-full truncate border px-2 py-0.5 text-[0.6875rem] leading-5 transition-colors sm:text-xs",
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

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span
            className={cn(
              "font-display text-base tracking-tight sm:text-xl",
              hasDiscount && "text-primary",
            )}
          >
            {formatPrice(displayPrice)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-[0.6875rem] text-muted-foreground line-through sm:text-xs">
                {formatPrice(unitPrice)}
              </span>
              <span className="label-mono rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.625rem] text-primary">
                −{discountPercent}%
              </span>
            </>
          )}
        </div>

        <Button
          variant="primary"
          size="none"
          pill
          disabled={stock <= 0}
          onClick={handleAdd}
          className="mt-2 w-full gap-1.5 px-2 py-2 text-[0.6875rem] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          <ShoppingBag className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">
            {stock > 0 ? t.cart.add : t.product.outOfStock}
          </span>
        </Button>
      </div>
    </motion.div>
  );
}
