"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowUpRight, Lightbulb, Zap, Thermometer, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/data/products";
import { useLang } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart/provider";
import { formatPrice, pick } from "@/lib/utils";
import { toSlug } from "@/lib/slug";

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
    >
      <Link href={`/products/${toSlug(product.id, product.name_ro)}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-muted">
          <Image
            src={product.images[0].imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          />
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
          <div className="min-w-0">
            <h3 className="font-display text-xl tracking-tight transition-colors group-hover:text-primary">
              {name}
            </h3>
            <div className="mt-2 flex items-center gap-4 text-muted-foreground">
              <Spec
                icon={<Lightbulb className="h-3.5 w-3.5" />}
                value={`${product.specifications.lumens} ${t.specsLabels.lm}`}
              />
              <Spec
                icon={<Zap className="h-3.5 w-3.5" />}
                value={`${product.specifications.wattage} ${t.specsLabels.w}`}
              />
              <Spec
                icon={<Thermometer className="h-3.5 w-3.5" />}
                value={product.specifications.colorTemp}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-2xl tracking-tight">
              {formatPrice(product.price)}
            </div>
          </div>
        </div>

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

function Spec({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {icon}
      {value}
    </span>
  );
}
