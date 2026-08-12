"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import {
  Film,
  Image as ImageIcon,
  Layers,
  ListChecks,
  ListPlus,
  Plus,
  Settings2,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createRental,
  updateRental,
  deleteRental,
  type RentalActionState,
  type ImagePayload,
  type VideoPayload,
  type VariantPayload,
} from "@/lib/admin/actions/rentals";
import type { SpecRow } from "@/lib/admin/specs";
import { MediaField, UploadButton } from "@/components/admin/media";
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
  TextArea,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

export type RentalFormData = {
  id: number;
  title_ro: string;
  title_ru: string;
  description_ro: string;
  description_ru: string;
  price: number;
  reducedPrice: number | null;
  categoryId: number | null;
  promotionId: number | null;
  isActive: boolean;
  specifications: SpecRow[];
  includes_ro: string[];
  includes_ru: string[];
  images: ImagePayload[];
  videos: VideoPayload[];
  variants: VariantPayload[];
  /** Applications that would be deleted along with the package. */
  applicationCount: number;
};

type Option = { id: number; name: string };

// Variant rows keep numeric fields as strings while editing; parsed on submit.
type VariantDraft = {
  id: number | null;
  name_ro: string;
  name_ru: string;
  size: string;
  price: string;
  reducedPrice: string;
  isDefault: boolean;
};

const iconBtn =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

const ghostBtn =
  "flex h-10 cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border px-3 text-sm transition-colors hover:bg-foreground/[0.03]";

/**
 * One "what's included" checklist. Rendered twice — once per language — and
 * kept a separate component so each list owns its own reorder state; the
 * order is what the package page prints, so it is worth dragging around.
 */
function IncludesEditor({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: string[];
  onChange: (rows: string[]) => void;
}) {
  const { t } = useAdminLang();
  const order = useReorder({
    count: rows.length,
    onMove: (from, to) => onChange(moveItem(rows, from, to)),
  });

  return (
    <Field label={label} hint={t.rentals.includesHint}>
      {rows.length > 0 && (
        <ul className="mb-2 flex flex-col gap-2">
          {rows.map((row, i) => (
            <li
              key={i}
              {...order.itemProps(i)}
              className={cn(
                "flex items-center gap-1 rounded-[var(--radius-md)]",
                order.dragIndex === i && draggingRow,
              )}
            >
              <DragHandle
                label={t.common.dragToReorder}
                {...order.handleProps(i)}
              />
              <TextInput
                value={row}
                onChange={(e) =>
                  onChange(rows.map((r, j) => (j === i ? e.target.value : r)))
                }
                placeholder={t.rentals.includePlaceholder}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={t.common.remove}
                className={iconBtn}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className={ghostBtn}
      >
        <Plus className="h-4 w-4" />
        {t.rentals.addInclude}
      </button>
    </Field>
  );
}

export function RentalForm({
  rental,
  categories,
  promotions,
}: {
  rental: RentalFormData | null;
  categories: Option[];
  promotions: Option[];
}) {
  const { t, lang } = useAdminLang();
  const action = rental ? updateRental.bind(null, rental.id) : createRental;
  const [state, formAction] = useActionState<RentalActionState, FormData>(
    action,
    null,
  );

  const [specs, setSpecs] = useState<SpecRow[]>(rental?.specifications ?? []);
  const setSpec = (index: number, patch: Partial<SpecRow>) =>
    setSpecs((prev) => prev.map((s, j) => (j === index ? { ...s, ...patch } : s)));
  const [includesRo, setIncludesRo] = useState<string[]>(rental?.includes_ro ?? []);
  const [includesRu, setIncludesRu] = useState<string[]>(rental?.includes_ru ?? []);
  const [images, setImages] = useState<ImagePayload[]>(rental?.images ?? []);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videos, setVideos] = useState<VideoPayload[]>(rental?.videos ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(
    (rental?.variants ?? []).map((v) => ({
      id: v.id,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size ?? "",
      price: String(v.price),
      reducedPrice: v.reducedPrice === null ? "" : String(v.reducedPrice),
      isDefault: v.isDefault,
    })),
  );

  const variantsPayload: VariantPayload[] = variants.map((v, i) => ({
    id: v.id,
    name_ro: v.name_ro,
    name_ru: v.name_ru,
    size: v.size || null,
    price: Number(v.price) || 0,
    reducedPrice: v.reducedPrice === "" ? null : Number(v.reducedPrice) || 0,
    isDefault: v.isDefault,
    sortOrder: i,
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
      <input type="hidden" name="includes_ro" value={JSON.stringify(includesRo)} />
      <input type="hidden" name="includes_ru" value={JSON.stringify(includesRu)} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="videos" value={JSON.stringify(videos)} />
      <input type="hidden" name="variants" value={JSON.stringify(variantsPayload)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard
            title={t.rentals.details}
            icon={<Tag className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.rentals.titleRo} htmlFor="title_ro">
                <TextInput id="title_ro" name="title_ro" defaultValue={rental?.title_ro} required />
              </Field>
              <Field label={t.rentals.titleRu} htmlFor="title_ru">
                <TextInput id="title_ru" name="title_ru" defaultValue={rental?.title_ru} required />
              </Field>
              <Field label={t.products.descriptionRo} htmlFor="description_ro" className="sm:col-span-2">
                <TextArea id="description_ro" name="description_ro" defaultValue={rental?.description_ro} />
              </Field>
              <Field label={t.products.descriptionRu} htmlFor="description_ru" className="sm:col-span-2">
                <TextArea id="description_ru" name="description_ru" defaultValue={rental?.description_ru} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.rentals.includes}
            icon={<ListChecks className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <IncludesEditor
                label={t.rentals.includesRo}
                rows={includesRo}
                onChange={setIncludesRo}
              />
              <IncludesEditor
                label={t.rentals.includesRu}
                rows={includesRu}
                onChange={setIncludesRu}
              />
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
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
                        <Image src={img.imageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {img.imageUrl}
                      </span>
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
                    key={i}
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
                        onChange={(url) =>
                          setVideos(videos.map((v, j) => (j === i ? { ...v, videoUrl: url } : v)))
                        }
                        placeholder={t.products.videoUrl}
                      />
                      <MediaField
                        accept="image"
                        value={video.thumbnailUrl ?? ""}
                        onChange={(url) =>
                          setVideos(
                            videos.map((v, j) =>
                              j === i ? { ...v, thumbnailUrl: url || null } : v,
                            ),
                          )
                        }
                        placeholder={t.products.thumbnailUrl}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <DragHandle
                        label={t.common.dragToReorder}
                        className="-ml-1"
                        {...videoOrder.handleProps(i)}
                      />
                      <button type="button" onClick={() => setVideos(videos.filter((_, j) => j !== i))} aria-label={t.common.remove} className={iconBtn}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setVideos([...videos, { videoUrl: "", thumbnailUrl: null }])}
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
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
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
                            step="0.01"
                            max="99999999.99"
                            inputMode="decimal"
                            value={v.price}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                          />
                        </Field>
                        <Field label={t.products.reduced} className="col-span-2 sm:col-span-1">
                          <TextInput
                            type="number"
                            min="0"
                            step="0.01"
                            max="99999999.99"
                            inputMode="decimal"
                            value={v.reducedPrice}
                            onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, reducedPrice: e.target.value } : x)))}
                          />
                        </Field>
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
                    price: rental ? String(rental.price) : "",
                    reducedPrice: "",
                    isDefault: variants.length === 0,
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
          <SectionCard title={t.products.price}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.products.price} htmlFor="price">
                <TextInput id="price" name="price" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" defaultValue={rental?.price} required />
              </Field>
              <Field label={t.products.reducedPrice} htmlFor="reducedPrice">
                <TextInput id="reducedPrice" name="reducedPrice" type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" defaultValue={rental?.reducedPrice ?? ""} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.products.organization}>
            <div className="flex flex-col gap-4">
              <Field label={t.products.category} htmlFor="categoryId">
                <AdminSelect
                  id="categoryId"
                  name="categoryId"
                  defaultValue={rental?.categoryId ? String(rental.categoryId) : ""}
                  options={[
                    { value: "", label: t.products.noCategory },
                    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </Field>
              <Field label={t.products.promotion} htmlFor="promotionId">
                <AdminSelect
                  id="promotionId"
                  name="promotionId"
                  defaultValue={rental?.promotionId ? String(rental.promotionId) : ""}
                  options={[
                    { value: "", label: t.products.noPromotion },
                    ...promotions.map((p) => ({ value: String(p.id), label: p.name })),
                  ]}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.products.visibility}>
            <Toggle name="isActive" label={t.products.activeInShop} defaultChecked={rental?.isActive ?? true} />
          </SectionCard>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 mt-6 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            {rental ? t.rentals.saveChanges : t.rentals.createRental}
          </SubmitButton>
          <ActionNotice state={state} />
          {rental && (
            <ConfirmButton
              action={deleteRental.bind(null, lang, rental.id)}
              confirmLabel={t.rentals.deleteRental}
              title={
                rental.applicationCount > 0
                  ? `${rental.applicationCount} ${t.rentals.applicationsCount}`
                  : undefined
              }
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
