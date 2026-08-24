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

export const runtime = "nodejs";

type PromotionLike = {
  startDate: Date;
  endDate: Date;
  discountPercent: number;
} | null;

function getPromotionStatus(
  promotion: PromotionLike,
  referenceDate: Date,
): "upcoming" | "active" | "expired" | null {
  if (!promotion) return null;
  if (referenceDate < promotion.startDate) return "upcoming";
  if (referenceDate > promotion.endDate) return "expired";
  return "active";
}

function normalizeDiscountPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return null;
  return value;
}

function calculateDiscountedPrice(price: unknown, discountPercent: number): number | null {
  const priceNumber = Number(price);
  if (!Number.isFinite(priceNumber)) return null;
  const discounted = priceNumber * ((100 - discountPercent) / 100);
  if (!Number.isFinite(discounted) || discounted >= priceNumber) return null;
  return Math.round(discounted * 100) / 100;
}

function resolvePromotionPricing(
  price: unknown,
  promotion: PromotionLike,
  referenceDate = new Date(),
): { reducedPrice: number | null; status: "upcoming" | "active" | "expired" | null } {
  if (!promotion) return { reducedPrice: null, status: null };
  const status = getPromotionStatus(promotion, referenceDate);
  const discount = normalizeDiscountPercent(promotion.discountPercent);
  if (status !== "active" || discount === null) return { reducedPrice: null, status };
  return { reducedPrice: calculateDiscountedPrice(price, discount), status };
}

type ProductForSerialization = Prisma.ProductGetPayload<{
  include: {
    images: true;
    videos: true;
    category: true;
    promotion: {
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

function serializeProduct(product: ProductForSerialization) {
  const promotionSnapshot = resolvePromotionPricing(product.price, product.promotion);

  const variants = product.variants.map((variant) => {
    const variantPricing = resolvePromotionPricing(variant.price, product.promotion);
    return {
      ...variant,
      price: Number(variant.price),
      reducedPrice: variantPricing.reducedPrice,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    };
  });

  return {
    ...product,
    price: Number(product.price),
    reducedPrice: promotionSnapshot.reducedPrice,
    variants,
    specifications:
      product.specifications && typeof product.specifications === "object"
        ? product.specifications
        : undefined,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    promotion: product.promotion
      ? {
          id: product.promotion.id,
          name_ro: product.promotion.name_ro,
          name_ru: product.promotion.name_ru,
          discountPercent: product.promotion.discountPercent,
          startDate: product.promotion.startDate.toISOString(),
          endDate: product.promotion.endDate.toISOString(),
        }
      : null,
    promotionStatus: promotionSnapshot.status,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get("categoryId");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 12));
    const search = searchParams.get("search")?.trim() || "";
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sortBy = searchParams.get("sort") || "featured";

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (categoryId && categoryId !== "all") {
      where.categoryId = parseInt(categoryId);
    }

    if (search) {
      where.OR = [
        { name_ro: { contains: search, mode: "insensitive" } },
        { name_ru: { contains: search, mode: "insensitive" } },
        { description_ro: { contains: search, mode: "insensitive" } },
        { description_ru: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
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
          { promotion: { discountPercent: "desc" } },
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
          promotion: {
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
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
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
