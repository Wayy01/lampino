"use client";

import type { Product } from "@/lib/data/products";
import { useT } from "@/lib/i18n/provider";
import { ProductCard } from "./product-card";

export function RelatedProducts({ products }: { products: Product[] }) {
  const t = useT();

  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8">
      <div className="border-t border-border pt-14">
        <div className="label-mono text-primary">{t.product.similarKicker}</div>
        <h2 className="font-display mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-0.02em]">
          {t.product.similarTitle}
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
