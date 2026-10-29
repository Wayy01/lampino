"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import type { AdminLang } from "@/lib/admin/i18n";
import { runAction, type ActionResult } from "@/lib/admin/errors";

export type ReviewStatus = "pending" | "approved" | "rejected";

function revalidateReviews(): void {
  revalidatePath("/admin/[lang]/reviews", "page");
}

/** Publish (`approved`) or hide (`rejected`) a review. */
export async function setReviewStatus(
  lang: AdminLang,
  id: number,
  status: Exclude<ReviewStatus, "pending">,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.review.update({ where: { id }, data: { status } });
    revalidateReviews();
  });
}

export async function deleteReview(lang: AdminLang, id: number): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.review.delete({ where: { id } });
    revalidateReviews();
  });
}
