import { prisma } from "../prisma";

export interface ProductReview {
  id: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

export interface ProductReviews {
  reviews: ProductReview[];
  count: number;
  /** Mean rating, one decimal; 0 when there are none. */
  average: number;
}

/** Approved reviews of a product, newest first, with the rating summary. */
export async function getProductReviews(productId: number, limit = 20): Promise<ProductReviews> {
  const where = { productId, status: "approved" };
  const [rows, agg] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.review.aggregate({ where, _count: { _all: true }, _avg: { rating: true } }),
  ]);
  return {
    reviews: rows.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
    count: agg._count._all,
    average: Math.round((agg._avg.rating ?? 0) * 10) / 10,
  };
}
