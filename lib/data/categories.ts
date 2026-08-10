import { categories } from "../mock-data";
import type { Category } from "../types";

export async function getCategories(): Promise<Category[]> {
  return [...categories].sort((a, b) => a.position - b.position);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return categories.find((c) => c.slug === slug) ?? null;
}
