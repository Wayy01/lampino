"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/data/products";
import { useLang } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart/provider";
import { formatPrice, pick, cn } from "@/lib/utils";
import { productHref } from "@/lib/i18n/routing";
import { specList, specValue } from "@/lib/specs";

const IMAGE_PLACEHOLDER =
  "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&q=80";

export function ProductCard({
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

  // Up to three at-a-glance spec values, whatever the product actually carries.
  const chips = specList(product.specifications)
    .map(([id, entry]) => ({ id, value: specValue(entry, lang) }))
    .filter((c) => c.value)
    .slice(0, 3);

  const hasDiscount =
    product.reducedPrice !== null && product.reducedPrice < product.price;
  const displayPrice = hasDiscount ? product.reducedPrice! : product.price;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    openCart();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        href={productHref(lang, product.id, product.name_ro)}
        className="group flex h-full flex-col"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-muted">
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          />
          {hasDiscount && (
            <div className="absolute right-4 top-4">
              <span className="label-mono rounded-full bg-primary px-3 py-1 text-primary-foreground">
                −{Math.round((1 - displayPrice / product.price) * 100)}%
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="absolute left-4 top-4">
            <span className="label-mono rounded-full bg-background/85 px-3 py-1 backdrop-blur">
              {product.category
                ? pick(lang, product.category.name_ro, product.category.name_ru)
                : ""}
            </span>
          </div>

          <div className="absolute bottom-4 right-4 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-background text-foreground opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <h3 className="font-display line-clamp-2 min-h-[2lh] min-w-0 text-xl tracking-tight transition-colors group-hover:text-primary">
            {name}
          </h3>
          <div className="shrink-0 text-right">
            {hasDiscount && (
              <div className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)}
              </div>
            )}
            <div
              className={cn(
                "font-display text-2xl tracking-tight",
                hasDiscount && "text-primary",
              )}
            >
              {formatPrice(displayPrice)}
            </div>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 overflow-hidden text-muted-foreground">
            {chips.map((chip) => (
              <Spec key={chip.id} value={chip.value} />
            ))}
          </div>
        )}

        <button
          onClick={handleAdd}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground cursor-pointer"
        >
          <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
          {t.cart.add}
        </button>
      </Link>
    </motion.div>
  );
}

function Spec({ value }: { value: React.ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs">
      <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
      {value}
    </span>
  );
}
