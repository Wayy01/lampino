"use client";

import { useActionState } from "react";
import { Boxes, CalendarRange, Tag, Trash2 } from "lucide-react";
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  type PromotionActionState,
} from "@/lib/admin/actions/promotions";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { SectionCard } from "@/components/admin/section-card";
import { ConfirmButton } from "@/components/admin/confirm-button";
import {
  Field,
  TextInput,
  TextArea,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
} from "@/components/admin/form-controls";

export type PromotionFormData = {
  id: number;
  name_ro: string;
  name_ru: string;
  description_ro: string;
  description_ru: string;
  /** `YYYY-MM-DD`, ready for `<input type="date">`. */
  startDate: string;
  endDate: string;
  discountPercent: number;
  featured: boolean;
  productIds: number[];
  rentalIds: number[];
};

type Option = { id: number; name: string };

const checkboxList =
  "mt-1 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-[var(--radius-md)] border p-3";

export function PromotionForm({
  promotion,
  products,
  rentals,
}: {
  promotion: PromotionFormData | null;
  products: Option[];
  rentals: Option[];
}) {
  const { t, lang } = useAdminLang();
  const action = promotion
    ? updatePromotion.bind(null, promotion.id)
    : createPromotion;
  const [state, formAction] = useActionState<PromotionActionState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction}>
      <LangField />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard
            title={t.promotions.details}
            icon={<Tag className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.products.nameRo} htmlFor="name_ro">
                <TextInput id="name_ro" name="name_ro" defaultValue={promotion?.name_ro} required />
              </Field>
              <Field label={t.products.nameRu} htmlFor="name_ru">
                <TextInput id="name_ru" name="name_ru" defaultValue={promotion?.name_ru} required />
              </Field>
              <Field label={t.products.descriptionRo} htmlFor="description_ro" className="sm:col-span-2">
                <TextArea id="description_ro" name="description_ro" defaultValue={promotion?.description_ro} />
              </Field>
              <Field label={t.products.descriptionRu} htmlFor="description_ru" className="sm:col-span-2">
                <TextArea id="description_ru" name="description_ru" defaultValue={promotion?.description_ru} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title={t.promotions.assigned}
            icon={<Boxes className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t.promotions.assignedProducts}>
                <div className={checkboxList}>
                  {products.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="productIds"
                        value={p.id}
                        defaultChecked={promotion?.productIds.includes(p.id)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={t.promotions.assignedRentals}>
                <div className={checkboxList}>
                  {rentals.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="rentalIds"
                        value={r.id}
                        defaultChecked={promotion?.rentalIds.includes(r.id)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="truncate">{r.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard
            title={t.promotions.schedule}
            icon={<CalendarRange className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.promotions.startDate} htmlFor="startDate">
                <TextInput
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={promotion?.startDate}
                  required
                />
              </Field>
              <Field label={t.promotions.endDate} htmlFor="endDate">
                <TextInput
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={promotion?.endDate}
                  required
                />
              </Field>
              <Field
                label={t.promotions.discountPercent}
                htmlFor="discountPercent"
                className="sm:col-span-2"
              >
                <TextInput
                  id="discountPercent"
                  name="discountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  inputMode="decimal"
                  defaultValue={promotion?.discountPercent ?? 0}
                  required
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title={t.products.visibility}>
            <Toggle
              name="featured"
              label={t.promotions.featuredPromotion}
              defaultChecked={promotion?.featured ?? false}
            />
          </SectionCard>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 mt-6 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>
            {promotion ? t.promotions.saveChanges : t.promotions.createPromotion}
          </SubmitButton>
          <ActionNotice state={state} />
          {promotion && (
            <ConfirmButton
              action={deletePromotion.bind(null, lang, promotion.id)}
              confirmLabel={t.promotions.deletePromotion}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.common.delete}</span>
            </ConfirmButton>
          )}
        </div>
      </div>
    </form>
  );
}
