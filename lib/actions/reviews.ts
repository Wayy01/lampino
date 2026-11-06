"use server";

// Public review submission. A review is stored as `pending` and only appears on
// the product page (and in its rating markup) once an admin approves it.
import { prisma } from "@/lib/prisma";
import { withinRateLimit } from "@/lib/rate-limit";
import { isLocale } from "@/lib/i18n/routing";
import { parseId } from "@/lib/utils";

/** Every way a submission can be refused; mapped to `t.reviews.errors`. */
export type ReviewError =
  | "invalid_name"
  | "invalid_rating"
  | "invalid_body"
  | "product_not_found"
  | "too_many_requests"
  | "server_error";

export type ReviewState = { ok: true } | { ok: false; error: ReviewError } | null;

const MAX_NAME = 80;
const MIN_BODY = 10;
const MAX_BODY = 2000;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function submitReview(_prev: ReviewState, fd: FormData): Promise<ReviewState> {
  // Bots fill every field; people never see this one.
  if (str(fd.get("website"))) return { ok: true };

  const productId = parseId(str(fd.get("productId")));
  const authorName = str(fd.get("authorName"));
  const body = str(fd.get("body"));
  const rating = Number(str(fd.get("rating")));
  const rawLang = str(fd.get("_lang"));

  if (!authorName || authorName.length > MAX_NAME) return { ok: false, error: "invalid_name" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "invalid_rating" };
  }
  if (body.length < MIN_BODY || body.length > MAX_BODY) return { ok: false, error: "invalid_body" };
  if (!(await withinRateLimit("review", 3, 60 * 60 * 1000))) {
    return { ok: false, error: "too_many_requests" };
  }

  try {
    const product =
      productId === null
        ? null
        : await prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
    if (!product) return { ok: false, error: "product_not_found" };

    await prisma.review.create({
      data: {
        productId: product.id,
        authorName,
        rating,
        body,
        lang: isLocale(rawLang) ? rawLang : "ro",
        status: "pending",
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("submitReview failed", error);
    return { ok: false, error: "server_error" };
  }
}
