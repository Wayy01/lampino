"use client";

import { PromotionPicker } from "@/components/admin/promotion-picker";
import type { PromotionOption } from "@/lib/admin/promotion-status";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { useActionState, useState } from "react";
import {
  Check,
  Film,
  Image as ImageIcon,
  Layers,
  ListPlus,
  Plus,
  Settings2,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductActionState,
  type ImagePayload,
  type VideoPayload,
  type VariantPayload,
} from "@/lib/admin/actions/products";
import type { SpecRow } from "@/lib/admin/specs";
import { AdminImage, ImagePreview, MediaField, UploadButton } from "@/components/admin/media";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { SectionCard } from "@/components/admin/section-card";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminSelect } from "@/components/admin/select";
import {
  DragHandle,
  draggingRow,
  moveItem,
  useReorder,
} from "@/components/admin/reorder";
import {
  Field,
  TextInput,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

export type ProductFormData = {
  id: number;
  name_ro: string;
  name_ru: string;
  description_ro: string;
  description_ru: string;
  price: number;
  reducedPrice: number | null;
  stock: number;
  categoryId: number | null;
  promotionIds: number[];
  featured: boolean;
  featuredOrder: number;
  isActive: boolean;
  specifications: SpecRow[];
  images: ImagePayload[];
  videos: VideoPayload[];
  variants: VariantPayload[];
};

type Option = { id: number; name: string };

// Video rows get a client-only id: an upload finishing after rows were added,
// removed or reordered must land on the row it started from, not an index.
type VideoRow = VideoPayload & { uid: number };
let nextVideoUid = 0;
const toVideoRow = (v: VideoPayload): VideoRow => ({ ...v, uid: nextVideoUid++ });

/** Parse a numeric draft; blank or garbage becomes null so the server can refuse it. */
const draftNumber = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Variant rows keep numeric fields as strings while editing; parsed on submit.
type VariantDraft = {
  id: number | null;
  name_ro: string;
  name_ru: string;
  size: string;
  price: string;
  reducedPrice: string;
  stock: string;
  isDefault: boolean;
  imageUrls: string[];
};

const iconBtn =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

const ghostBtn =
  "flex h-10 cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border px-3 text-sm transition-colors hover:bg-foreground/[0.03]";

export function ProductForm({
  product,
  categories,
  promotions,
}: {
  product: ProductFormData | null;
  categories: Option[];
  promotions: PromotionOption[];
}) {
  const { t, lang } = useAdminLang();
  const action = product ? updateProduct.bind(null, product.id) : createProduct;
  const [state, formAction] = useActionState<ProductActionState, FormData>(
    action,
    null,
  );

  const [specs, setSpecs] = useState<SpecRow[]>(product?.specifications ?? []);
  const setSpec = (index: number, patch: Partial<SpecRow>) =>
    setSpecs((prev) => prev.map((s, j) => (j === index ? { ...s, ...patch } : s)));
  const [images, setImages] = useState<ImagePayload[]>(product?.images ?? []);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videos, setVideos] = useState<VideoRow[]>(() =>
    (product?.videos ?? []).map(toVideoRow),
  );
  const patchVideo = (uid: number, patch: Partial<VideoPayload>) =>
    setVideos((prev) => prev.map((v) => (v.uid === uid ? { ...v, ...patch } : v)));
  const [variants, setVariants] = useState<VariantDraft[]>(
    (product?.variants ?? []).map((v) => ({
      id: v.id,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size ?? "",
      price: String(v.price),
      reducedPrice: v.reducedPrice === null ? "" : String(v.reducedPrice),
      stock: String(v.stock),
      isDefault: v.isDefault,
      imageUrls: v.imageUrls,
    })),
  );
  const toggleVariantImage = (index: number, url: string) =>
    setVariants((prev) =>
      prev.map((x, j) =>
        j !== index
          ? x
          : {
              ...x,
              imageUrls: x.imageUrls.includes(url)
                ? x.imageUrls.filter((u) => u !== url)
                : [...x.imageUrls, url],
            },
      ),
    );
  // Upload straight into the product gallery and mark it for this variant.
  const uploadVariantImage = (index: number, url: string) => {
    setImages((prev) => [...prev, { imageUrl: url, isMain: prev.length === 0 }]);
    setVariants((prev) =>
      prev.map((x, j) => (j === index ? { ...x, imageUrls: [...x.imageUrls, url] } : x)),
    );
  };

  const variantsPayload: VariantPayload[] = variants.map((v, i) => ({
    id: v.id,
    name_ro: v.name_ro,
    name_ru: v.name_ru,
    size: v.size || null,
    price: draftNumber(v.price),
    reducedPrice: draftNumber(v.reducedPrice),
    stock: draftNumber(v.stock) ?? 0,
    isDefault: v.isDefault,
    sortOrder: i,
    // An image removed from the gallery drops out of every variant too.
    imageUrls: v.imageUrls.filter((u) => images.some((img) => img.imageUrl === u)),
  }));

  // Every sub-collection is ordered, and every one of them reorders by drag
  // (or by ArrowUp/ArrowDown on a focused handle). Nothing is persisted until
  // the form is submitted — the hidden JSON fields carry the new order.
  const imageOrder = useReorder({
    count: images.length,
    onMove: (from, to) => setImages((prev) => moveItem(prev, from, to)),
  });
  const videoOrder = useReorder({
    count: videos.length,
    onMove: (from, to) => setVideos((prev) => moveItem(prev, from, to)),
  });
  const variantOrder = useReorder({
    count: variants.length,
    onMove: (from, to) => setVariants((prev) => moveItem(prev, from, to)),
  });
  const specOrder = useReorder({
    count: specs.length,
    onMove: (from, to) => setSpecs((prev) => moveItem(prev, from, to)),
  });

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setImages((prev) => [...prev, { imageUrl: url, isMain: prev.length === 0 }]);
    setNewImageUrl("");
  };

  return (
    <AdminForm action={formAction}>
      {/* Editors serialize into hidden fields; scalars post natively. */}
      <LangField />
      <input type="hidden" name="specifications" value={JSON.stringify(specs)} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input
        type="hidden"
        name="videos"
        value={JSON.stringify(videos.map(({ videoUrl, thumbnailUrl }) => ({ videoUrl, thumbnailUrl })))}
      />
      <input type="hidden" name="variants" value={JSON.stringify(variantsPayload)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard
            title={t.products.details}
            icon={<Tag className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.products.nameRo} htmlFor="name_ro">
                <TextInput id="name_ro" name="name_ro" defaultValue={product?.name_ro} required />
              </Field>
              <Field label={t.products.nameRu} htmlFor="name_ru">
                <TextInput id="name_ru" name="name_ru" defaultValue={product?.name_ru} required />
              </Field>
              <Field label={t.products.descriptionRo} htmlFor="description_ro" className="sm:col-span-2">
                <RichTextEditor id="description_ro" name="description_ro" defaultValue={product?.description_ro} />
              </Field>
              <Field label={t.products.descriptionRu} htmlFor="description_ru" className="sm:col-span-2">
                <RichTextEditor id="description_ru" name="description_ru" defaultValue={product?.description_ru} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.products.images}
            icon={<ImageIcon className="h-4 w-4" strokeWidth={1.75} />}
          >
            {images.length > 0 && (
              <ul className="mb-4 flex flex-col gap-2">
                {images.map((img, i) => (
                  <li
                    key={`${img.imageUrl}-${i}`}
                    {...imageOrder.itemProps(i)}
                    className={cn(
                      "rounded-[var(--radius-md)] border p-3",
                      imageOrder.dragIndex === i && draggingRow,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <DragHandle
                        label={t.common.dragToReorder}
                        className="-ml-1"
                        {...imageOrder.handleProps(i)}
                      />
                      <ImagePreview url={img.imageUrl} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="mainImage"
                          checked={img.isMain}
                          onChange={() =>
                            setImages(images.map((im, j) => ({ ...im, isMain: j === i })))
                          }
                          className="accent-[var(--primary)]"
                        />
                        {t.products.mainImage}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = images.filter((_, j) => j !== i);
                          if (img.isMain && next.length > 0) next[0] = { ...next[0], isMain: true };
                          setImages(next);
                        }}
                        aria-label={t.common.remove}
                        className={iconBtn}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImage();
                  }
                }}
                placeholder={t.products.imageUrlPlaceholder}
              />
              <div className="flex gap-2">
                <button type="button" onClick={addImage} className={`${ghostBtn} flex-1 justify-center sm:flex-none sm:shrink-0`}>
                  <Plus className="h-4 w-4" />
                  {t.common.add}
                </button>
                <UploadButton
                  accept="image"
                  onUploaded={(url) =>
                    setImages((prev) => [
                      ...prev,
                      { imageUrl: url, isMain: prev.length === 0 },
                    ])
                  }
                  className="flex-1 sm:flex-none sm:shrink-0"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t.products.videos}
            icon={<Film className="h-4 w-4" strokeWidth={1.75} />}
          >
            {videos.length > 0 && (
              <ul className="mb-4 flex flex-col gap-2">
                {videos.map((video, i) => (
                  <li
                    key={video.uid}
                    {...videoOrder.itemProps(i)}
                    className={cn(
                      "rounded-[var(--radius-md)] border p-3",
                      videoOrder.dragIndex === i && draggingRow,
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <MediaField
                        accept="video"
                        value={video.videoUrl}
                        onChange={(url) => patchVideo(video.uid, { videoUrl: url })}
                        placeholder={t.products.videoUrl}
                      />
                      <MediaField
                        accept="image"
                        value={video.thumbnailUrl ?? ""}
                        onChange={(url) => patchVideo(video.uid, { thumbnailUrl: url || null })}
                        placeholder={t.products.thumbnailUrl}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <DragHandle
                        label={t.common.dragToReorder}
                        className="-ml-1"
                        {...videoOrder.handleProps(i)}
                      />
                      <button type="button" onClick={() => setVideos((prev) => prev.filter((v) => v.uid !== video.uid))} aria-label={t.common.remove} className={iconBtn}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() =>
                setVideos((prev) => [...prev, toVideoRow({ videoUrl: "", thumbnailUrl: null })])
              }
              className={ghostBtn}
            >
              <Plus className="h-4 w-4" />
              {t.products.addVideo}
            </button>
          </SectionCard>

          <SectionCard
            title={t.products.variants}
            icon={<Layers className="h-4 w-4" strokeWidth={1.75} />}
          >
            {variants.length > 0 && (
              <ul className="mb-4 flex flex-col gap-3">
                {variants.map((v, i) => (
                  <li
                    key={i}
                    {...variantOrder.itemProps(i)}
                    className={cn(
                      "rounded-[var(--radius-md)] border p-3",
                      variantOrder.dragIndex === i && draggingRow,
                    )}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t.products.nameRo}>
                        <TextInput
                          value={v.name_ro}
                          onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, name_ro: e.target.value } : x)))}
                        />
                      </Field>
                      <Field label={t.products.nameRu}>
                        <TextInput
                          value={v.name_ru}
                          onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, name_ru: e.target.value } : x)))}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
                        <Field label={t.products.size}>
                          <TextInput
                            value={v.size}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))}
                          />
                        </Field>
                        <Field label={t.products.price}>
                          <TextInput
                            type="number"
                            min="0"
                            max="99999999.99"
                            step="0.01"
                            inputMode="decimal"
                            value={v.price}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                          />
                        </Field>
                        <Field label={t.products.reduced}>
                          <TextInput
                            type="number"
                            min="0"
                            max="99999999.99"
                            step="0.01"
                            inputMode="decimal"
                            value={v.reducedPrice}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, reducedPrice: e.target.value } : x)))}
                          />
                        </Field>
                        <Field label={t.products.stock}>
                          <TextInput
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={v.stock}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))}
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="mt-3 border-t pt-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="label-mono text-muted-foreground">
                          {t.products.variantImages}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {variantsPayload[i].imageUrls.length === 0
                            ? t.products.variantImagesAll
                            : `${variantsPayload[i].imageUrls.length} / ${images.length}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t.products.variantImagesHint}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {images.map((img) => {
                          const on = v.imageUrls.includes(img.imageUrl);
                          return (
                            <button
                              key={img.imageUrl}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleVariantImage(i, img.imageUrl)}
                              className={cn(
                                "relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-sm)] bg-muted transition",
                                on
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                  : "opacity-50 hover:opacity-100",
                              )}
                            >
                              <AdminImage src={img.imageUrl} alt="" sizes="64px" unoptimized compact className="object-cover" />
                              {on && (
                                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                        <UploadButton
                          accept="image"
                          compact
                          label={t.products.variantImagesUpload}
                          onUploaded={(url) => uploadVariantImage(i, url)}
                          className="[&>button]:h-16 [&>button]:w-16 [&>button]:border-dashed"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="defaultVariant"
                          checked={v.isDefault}
                          onChange={() => setVariants(variants.map((x, j) => ({ ...x, isDefault: j === i })))}
                          className="accent-[var(--primary)]"
                        />
                        {t.products.defaultVariant}
                      </label>
                      <div className="flex items-center">
                        <DragHandle
                          label={t.common.dragToReorder}
                          {...variantOrder.handleProps(i)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = variants.filter((_, j) => j !== i);
                            if (v.isDefault && next.length > 0) next[0] = { ...next[0], isDefault: true };
                            setVariants(next);
                          }}
                          aria-label={t.common.remove}
                          className={iconBtn}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() =>
                setVariants([
                  ...variants,
                  {
                    id: null,
                    name_ro: "",
                    name_ru: "",
                    size: "",
                    price: product ? String(product.price) : "",
                    reducedPrice: "",
                    stock: "0",
                    isDefault: variants.length === 0,
                    imageUrls: [],
                  },
                ])
              }
              className={ghostBtn}
            >
              <ListPlus className="h-4 w-4" />
              {t.products.addVariant}
            </button>
          </SectionCard>

          <SectionCard
            title={t.products.specifications}
            icon={<Settings2 className="h-4 w-4" strokeWidth={1.75} />}
          >
            {specs.length > 0 && (
              <ul className="mb-4 flex flex-col gap-3">
                {specs.map((spec, i) => (
                  <li
                    key={i}
                    {...specOrder.itemProps(i)}
                    className={cn(
                      "rounded-[var(--radius-md)] border p-3",
                      specOrder.dragIndex === i && draggingRow,
                    )}
                  >
                    <div className="flex items-end gap-2">
                      <DragHandle
                        label={t.common.dragToReorder}
                        className="-ml-1 mb-0.5"
                        {...specOrder.handleProps(i)}
                      />
                      <Field label={t.products.specId} htmlFor={`spec_id_${i}`} className="flex-1">
                        <TextInput
                          id={`spec_id_${i}`}
                          value={spec.id}
                          onChange={(e) => setSpec(i, { id: e.target.value })}
                          placeholder={t.products.specIdPlaceholder}
                          className="font-mono"
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
                        aria-label={t.common.remove}
                        className={`${iconBtn} mb-0.5`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label={t.products.nameRo}>
                        <TextInput
                          value={spec.label_ro}
                          onChange={(e) => setSpec(i, { label_ro: e.target.value })}
                        />
                      </Field>
                      <Field label={t.products.nameRu}>
                        <TextInput
                          value={spec.label_ru}
                          onChange={(e) => setSpec(i, { label_ru: e.target.value })}
                        />
                      </Field>
                      <Field label={t.products.valueRo}>
                        <TextInput
                          value={spec.value_ro}
                          onChange={(e) => setSpec(i, { value_ro: e.target.value })}
                        />
                      </Field>
                      <Field label={t.products.valueRu}>
                        <TextInput
                          value={spec.value_ru}
                          onChange={(e) => setSpec(i, { value_ru: e.target.value })}
                        />
                      </Field>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() =>
                setSpecs([
                  ...specs,
                  { id: "", label_ro: "", label_ru: "", value_ro: "", value_ru: "" },
                ])
              }
              className={ghostBtn}
            >
              <Plus className="h-4 w-4" />
              {t.products.addSpecification}
            </button>
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title={t.products.pricingStock}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.products.price} htmlFor="price">
                <TextInput id="price" name="price" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" defaultValue={product?.price} required />
              </Field>
              <Field label={t.products.reducedPrice} htmlFor="reducedPrice">
                <TextInput id="reducedPrice" name="reducedPrice" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" defaultValue={product?.reducedPrice ?? ""} />
              </Field>
              <Field label={t.products.stock} htmlFor="stock" className="col-span-2">
                <TextInput id="stock" name="stock" type="number" min="0" inputMode="numeric" defaultValue={product?.stock ?? 0} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.products.organization}>
            <div className="flex flex-col gap-4">
              <Field label={t.products.category} htmlFor="categoryId">
                <AdminSelect
                  id="categoryId"
                  name="categoryId"
                  defaultValue={product?.categoryId ? String(product.categoryId) : ""}
                  options={[
                    { value: "", label: t.products.noCategory },
                    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </Field>
              <Field label={t.products.promotion}>
                <PromotionPicker promotions={promotions} selected={product?.promotionIds ?? []} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.products.visibility}>
            <div className="flex flex-col gap-4">
              <Toggle name="isActive" label={t.products.activeInShop} defaultChecked={product?.isActive ?? true} />
              <Toggle name="featured" label={t.products.featuredOnHomepage} defaultChecked={product?.featured ?? false} />
              <Field label={t.products.featuredOrder} htmlFor="featuredOrder">
                <TextInput id="featuredOrder" name="featuredOrder" type="number" min="0" inputMode="numeric" defaultValue={product?.featuredOrder ?? 0} />
              </Field>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 mt-6 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            {product ? t.products.saveChanges : t.products.createProduct}
          </SubmitButton>
          <ActionNotice state={state} />
          {product && (
            <ConfirmButton
              action={deleteProduct.bind(null, lang, product.id)}
              confirmLabel={t.products.deleteProduct}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.common.delete}</span>
            </ConfirmButton>
          )}
        </div>
      </div>
    </AdminForm>
  );
}
