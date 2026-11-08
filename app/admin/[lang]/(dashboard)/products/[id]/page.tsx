import { notFound } from "next/navigation";
import { toPromotionOption } from "@/lib/admin/promotion-status";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { num } from "@/lib/admin/serialize";
import { parseId, pick } from "@/lib/utils";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { specsFromJson } from "@/lib/admin/specs";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ProductForm, type ProductFormData } from "@/components/admin/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const productId = parseId(id);
  if (productId === null) notFound();

  const [product, categories, promotions] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { id: "asc" } },
        videos: { orderBy: { id: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        promotions: { select: { id: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.promotion.findMany({ orderBy: { startDate: "desc" } }),
  ]);
  if (!product || product.deletedAt) notFound();

  const formData: ProductFormData = {
    id: product.id,
    name_ro: product.name_ro,
    name_ru: product.name_ru,
    description_ro: product.description_ro,
    description_ru: product.description_ru,
    imageAlt_ro: product.imageAlt_ro,
    imageAlt_ru: product.imageAlt_ru,
    price: num(product.price),
    reducedPrice: num(product.reducedPrice),
    stock: product.stock,
    weightGrams: product.weightGrams,
    lengthMm: product.lengthMm,
    widthMm: product.widthMm,
    heightMm: product.heightMm,
    categoryId: product.categoryId,
    promotionIds: product.promotions.map((p) => p.id),
    featured: product.featured,
    featuredOrder: product.featuredOrder,
    isActive: product.isActive,
    specifications: specsFromJson(product.specifications),
    images: product.images
      .slice()
      .sort((a, b) => Number(b.isMain) - Number(a.isMain))
      .map((i) => ({ imageUrl: i.imageUrl, isMain: i.isMain })),
    videos: product.videos.map((v) => ({
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size,
      price: num(v.price),
      reducedPrice: num(v.reducedPrice),
      stock: v.stock,
      weightGrams: v.weightGrams,
      lengthMm: v.lengthMm,
      widthMm: v.widthMm,
      heightMm: v.heightMm,
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
      imageUrls: v.imageUrls,
    })),
  };

  return (
    <>
      <PageHeader
        title={pick(lang, product.name_ro, product.name_ru)}
        backHref={adminHref(lang, "/products")}
        backLabel={t.products.title}
        actions={
          <StatusBadge
            status={product.isActive ? "active" : "inactive"}
            label={statusLabel(t, product.isActive ? "active" : "inactive")}
          />
        }
      />
      <ProductForm
        product={formData}
        categories={categories.map((c) => ({
          id: c.id,
          name: pick(lang, c.name_ro, c.name_ru),
        }))}
        promotions={promotions.map((p) => toPromotionOption(p, pick(lang, p.name_ro, p.name_ru)))}
      />
    </>
  );
}
