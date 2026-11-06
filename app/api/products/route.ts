// Legacy compat endpoint: mirrors the lampino-md project's `/api/products`
// route (same URL, query params, and JSON response shape) so external bots
// still pointed at it keep working. lampino-md's version leans on service
// modules (lib/logger, lib/cache/apiCache, lib/services/products/*,
// lib/services/promotion-utils) that don't exist in this app, so the
// promotion-pricing and serialization logic they provided is inlined here
// instead of imported. No caching layer — this app has none, and bots don't
// need it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { bestActivePromotion, effectiveReducedPrice, promotionState } from "@/lib/promotions";

export const runtime = "nodejs";

type ProductForSerialization = Prisma.ProductGetPayload<{
  include: {
    images: true;
    videos: true;
    category: true;
    promotions: {
      select: {
        id: true;
        name_ro: true;
        name_ru: true;
        discountPercent: true;
        startDate: true;
        endDate: true;
      };
    };
    variants: true;
  };
}>;

const MAX_INT = 2_147_483_647;

/** A positive Int4 id from untrusted input, or null. */
function parseId(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n > 0 && n <= MAX_INT ? n : null;
}

/** A finite, non-negative price filter, or null (ignored). */
function parsePrice(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function serializeProduct(product: ProductForSerialization) {
  // Same rules as the storefront and checkout (lib/promotions.ts): the best
  // running promotion is folded into `reducedPrice`, so bots quote exactly
  // what a customer pays. When none is running, the next scheduled one is
  // reported for information only.
  const now = new Date();
  const active = bestActivePromotion(product.promotions, now);
  const upcoming = product.promotions
    .filter((p) => promotionState(p, now) === "scheduled")
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
  const shown = active ?? upcoming ?? null;
  const pct = active?.discountPercent ?? null;
  const { promotions: _all, ...rest } = product;
  void _all;

  const variants = product.variants.map((variant) => {
    return {
      ...variant,
      price: Number(variant.price),
      reducedPrice: effectiveReducedPrice(
        Number(variant.price),
        variant.reducedPrice === null ? null : Number(variant.reducedPrice),
        pct,
      ),
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    };
  });

  return {
    ...rest,
    price: Number(product.price),
    reducedPrice: effectiveReducedPrice(
      Number(product.price),
      product.reducedPrice === null ? null : Number(product.reducedPrice),
      pct,
    ),
    variants,
    specifications:
      product.specifications && typeof product.specifications === "object"
        ? product.specifications
        : undefined,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    promotion: shown
      ? {
          id: shown.id,
          name_ro: shown.name_ro,
          name_ru: shown.name_ru,
          discountPercent: shown.discountPercent,
          startDate: shown.startDate.toISOString(),
          endDate: shown.endDate.toISOString(),
        }
      : null,
    promotionStatus: shown ? (active ? "active" : "upcoming") : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get("categoryId");
    const page = Math.min(10_000, Math.max(1, Math.floor(Number(searchParams.get("page")) || 1)));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get("limit")) || 12)));
    const search = searchParams.get("search")?.trim() || "";
    const minPrice = parsePrice(searchParams.get("minPrice"));
    const maxPrice = parsePrice(searchParams.get("maxPrice"));
    const sortBy = searchParams.get("sort") || "featured";

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (categoryId && categoryId !== "all") {
      // A malformed id matches nothing rather than erroring the request.
      where.categoryId = parseId(categoryId) ?? -1;
    }

    if (search) {
      where.OR = [
        { name_ro: { contains: search, mode: "insensitive" } },
        { name_ru: { contains: search, mode: "insensitive" } },
        { description_ro: { contains: search, mode: "insensitive" } },
        { description_ru: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minPrice !== null || maxPrice !== null) {
      where.price = {};
      if (minPrice !== null) where.price.gte = minPrice;
      if (maxPrice !== null) where.price.lte = maxPrice;
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] = {
      createdAt: "desc",
    };

    switch (sortBy) {
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "price-low":
        orderBy = { price: "asc" };
        break;
      case "price-high":
        orderBy = { price: "desc" };
        break;
      case "rating":
        orderBy = { createdAt: "desc" };
        break;
      case "featured":
      default:
        orderBy = [
          { featured: "desc" },
          { featuredOrder: "asc" },
          { createdAt: "desc" },
        ];
        break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { orderBy: { isMain: "desc" } },
          videos: { take: 1 },
          category: true,
          promotions: {
            select: {
              id: true,
              name_ro: true,
              name_ru: true,
              discountPercent: true,
              startDate: true,
              endDate: true,
            },
          },
          variants: { orderBy: { sortOrder: "asc" } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.product.count({ where }),
    ]);

    const formattedProducts = products.map(serializeProduct);

    return NextResponse.json({
      products: formattedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/products", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const id = parseId(body && typeof body === "object" ? body.id : null);

    if (id === null) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Hidden products are as invisible here as they are in the shop.
    const product = await prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        images: true,
        videos: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("POST /api/products", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
