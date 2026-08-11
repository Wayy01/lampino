"use client";

import { useActionState, useState } from "react";
import { Contact, Palette, Sparkles, Truck } from "lucide-react";
import {
  updateContact,
  updateDelivery,
  updateTheme,
  updateSpecialOffers,
  type SettingsActionState,
} from "@/lib/admin/actions/settings";
import { useAdminT } from "@/lib/admin/i18n-provider";
import type { AdminDict } from "@/lib/admin/i18n";
import { SectionCard } from "@/components/admin/section-card";
import { MediaField } from "@/components/admin/media";
import { AdminSelect } from "@/components/admin/select";
import {
  Field,
  TextInput,
  TextArea,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
} from "@/components/admin/form-controls";

export type ContactData = {
  phone: string;
  email: string;
  whatsapp: string;
  address_ro: string;
  address_ru: string;
  city_ro: string;
  city_ru: string;
  country_ro: string;
  country_ru: string;
  businessHours_ro: string;
  businessHours_ru: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  isActive: boolean;
};

export type DeliveryData = {
  freeDeliveryThreshold: number;
  deliveryCostChisinau: number;
  deliveryCostOutside: number;
  isActive: boolean;
};

export type ThemeData = {
  colorPrimary: string;
  colorSecondary: string;
  colorTertiary: string;
  colorAccent: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;
  isActive: boolean;
};

export type SpecialOffersData = {
  title_ro: string;
  title_ru: string;
  description_ro: string;
  description_ru: string;
  mediaUrl: string | null;
  mediaType: string;
  selectionMethod: string;
  selectedProductIds: number[];
  selectedRentalPackageIds: number[];
  filterByCategoryId: number | null;
  isActive: boolean;
};

type Option = { id: number; name: string };

function FormFooter({
  state,
  label,
}: {
  state: SettingsActionState;
  label: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
      <SubmitButton>{label}</SubmitButton>
      <ActionNotice state={state} />
    </div>
  );
}

export function ContactForm({ contact }: { contact: ContactData | null }) {
  const t = useAdminT();
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateContact,
    null,
  );

  return (
    <SectionCard
      title={t.settings.contact}
      icon={<Contact className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t.settings.phone} htmlFor="ct_phone">
            <TextInput id="ct_phone" name="phone" type="tel" defaultValue={contact?.phone} />
          </Field>
          <Field label={t.settings.email} htmlFor="ct_email">
            <TextInput id="ct_email" name="email" type="email" defaultValue={contact?.email} />
          </Field>
          <Field label={t.settings.whatsapp} htmlFor="ct_wa">
            <TextInput id="ct_wa" name="whatsapp" type="tel" defaultValue={contact?.whatsapp} />
          </Field>
          <Field label={t.settings.addressRo} htmlFor="ct_a_ro">
            <TextInput id="ct_a_ro" name="address_ro" defaultValue={contact?.address_ro} />
          </Field>
          <Field label={t.settings.addressRu} htmlFor="ct_a_ru">
            <TextInput id="ct_a_ru" name="address_ru" defaultValue={contact?.address_ru} />
          </Field>
          <Field label={t.settings.cityRo} htmlFor="ct_c_ro">
            <TextInput id="ct_c_ro" name="city_ro" defaultValue={contact?.city_ro} />
          </Field>
          <Field label={t.settings.cityRu} htmlFor="ct_c_ru">
            <TextInput id="ct_c_ru" name="city_ru" defaultValue={contact?.city_ru} />
          </Field>
          <Field label={t.settings.countryRo} htmlFor="ct_co_ro">
            <TextInput id="ct_co_ro" name="country_ro" defaultValue={contact?.country_ro} />
          </Field>
          <Field label={t.settings.countryRu} htmlFor="ct_co_ru">
            <TextInput id="ct_co_ru" name="country_ru" defaultValue={contact?.country_ru} />
          </Field>
          <Field label={t.settings.hoursRo} htmlFor="ct_h_ro">
            <TextInput id="ct_h_ro" name="businessHours_ro" defaultValue={contact?.businessHours_ro} />
          </Field>
          <Field label={t.settings.hoursRu} htmlFor="ct_h_ru">
            <TextInput id="ct_h_ru" name="businessHours_ru" defaultValue={contact?.businessHours_ru} />
          </Field>
          <Field label={t.settings.facebook} htmlFor="ct_fb">
            <TextInput id="ct_fb" name="facebookUrl" defaultValue={contact?.facebookUrl} />
          </Field>
          <Field label={t.settings.instagram} htmlFor="ct_ig">
            <TextInput id="ct_ig" name="instagramUrl" defaultValue={contact?.instagramUrl} />
          </Field>
          <Field label={t.settings.tiktok} htmlFor="ct_tt">
            <TextInput id="ct_tt" name="tiktokUrl" defaultValue={contact?.tiktokUrl} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle name="isActive" label={t.settings.sectionEnabled} defaultChecked={contact?.isActive ?? true} />
        </div>
        <FormFooter state={state} label={t.settings.saveContact} />
      </form>
    </SectionCard>
  );
}

export function DeliveryForm({ delivery }: { delivery: DeliveryData | null }) {
  const t = useAdminT();
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateDelivery,
    null,
  );

  return (
    <SectionCard
      title={t.settings.delivery}
      icon={<Truck className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t.settings.freeThreshold} htmlFor="dl_free">
            <TextInput id="dl_free" name="freeDeliveryThreshold" type="number" min="0" inputMode="decimal" defaultValue={delivery?.freeDeliveryThreshold ?? 1500} />
          </Field>
          <Field label={t.settings.costChisinau} htmlFor="dl_chisinau">
            <TextInput id="dl_chisinau" name="deliveryCostChisinau" type="number" min="0" inputMode="decimal" defaultValue={delivery?.deliveryCostChisinau ?? 50} />
          </Field>
          <Field label={t.settings.costOutside} htmlFor="dl_outside">
            <TextInput id="dl_outside" name="deliveryCostOutside" type="number" min="0" inputMode="decimal" defaultValue={delivery?.deliveryCostOutside ?? 90} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle name="isActive" label={t.settings.sectionEnabled} defaultChecked={delivery?.isActive ?? true} />
        </div>
        <FormFooter state={state} label={t.settings.saveDelivery} />
      </form>
    </SectionCard>
  );
}

const THEME_FIELDS: {
  name: keyof Omit<ThemeData, "isActive">;
  label: (t: AdminDict) => string;
}[] = [
  { name: "colorPrimary", label: (t) => t.settings.primary },
  { name: "colorSecondary", label: (t) => t.settings.secondary },
  { name: "colorTertiary", label: (t) => t.settings.tertiary },
  { name: "colorAccent", label: (t) => t.settings.accent },
  { name: "colorSuccess", label: (t) => t.settings.success },
  { name: "colorWarning", label: (t) => t.settings.warning },
  { name: "colorError", label: (t) => t.settings.error },
  { name: "colorInfo", label: (t) => t.settings.info },
];

export function ThemeForm({ theme }: { theme: ThemeData | null }) {
  const t = useAdminT();
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateTheme,
    null,
  );

  return (
    <SectionCard
      title={t.settings.theme}
      icon={<Palette className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {THEME_FIELDS.map(({ name, label }) => (
            <Field key={name} label={label(t)} htmlFor={`th_${name}`}>
              <div className="flex items-center gap-2">
                <input
                  id={`th_${name}`}
                  name={name}
                  type="color"
                  defaultValue={theme?.[name] ?? "#000000"}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border bg-background p-1"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {theme?.[name] ?? "—"}
                </span>
              </div>
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Toggle name="isActive" label={t.settings.sectionEnabled} defaultChecked={theme?.isActive ?? true} />
        </div>
        <FormFooter state={state} label={t.settings.saveTheme} />
      </form>
    </SectionCard>
  );
}

export function SpecialOffersForm({
  offers,
  categories,
  products,
  rentals,
}: {
  offers: SpecialOffersData | null;
  categories: Option[];
  products: Option[];
  rentals: Option[];
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState<SettingsActionState, FormData>(
    updateSpecialOffers,
    null,
  );
  const [method, setMethod] = useState(offers?.selectionMethod ?? "manual");

  return (
    <SectionCard
      title={t.settings.specialOffers}
      icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.settings.titleRo} htmlFor="so_t_ro">
            <TextInput id="so_t_ro" name="title_ro" defaultValue={offers?.title_ro} />
          </Field>
          <Field label={t.settings.titleRu} htmlFor="so_t_ru">
            <TextInput id="so_t_ru" name="title_ru" defaultValue={offers?.title_ru} />
          </Field>
          <Field label={t.settings.descriptionRo} htmlFor="so_d_ro" className="sm:col-span-2">
            <TextArea id="so_d_ro" name="description_ro" rows={3} defaultValue={offers?.description_ro} />
          </Field>
          <Field label={t.settings.descriptionRu} htmlFor="so_d_ru" className="sm:col-span-2">
            <TextArea id="so_d_ru" name="description_ru" rows={3} defaultValue={offers?.description_ru} />
          </Field>
          <Field label={t.settings.mediaUrl} htmlFor="so_media">
            <MediaField id="so_media" name="mediaUrl" defaultValue={offers?.mediaUrl ?? ""} accept="media" />
          </Field>
          <Field label={t.settings.mediaType} htmlFor="so_mtype">
            <AdminSelect
              id="so_mtype"
              name="mediaType"
              defaultValue={offers?.mediaType ?? "image"}
              options={[
                { value: "image", label: t.common.image },
                { value: "video", label: t.common.video },
              ]}
            />
          </Field>
          <Field label={t.settings.selectionMethod} htmlFor="so_method">
            <AdminSelect
              id="so_method"
              name="selectionMethod"
              value={method}
              onValueChange={setMethod}
              options={[
                { value: "manual", label: t.settings.manual },
                { value: "category", label: t.settings.byCategory },
              ]}
            />
          </Field>
          {method === "category" && (
            <Field label={t.settings.filterCategory} htmlFor="so_cat">
              <AdminSelect
                id="so_cat"
                name="filterByCategoryId"
                defaultValue={
                  offers?.filterByCategoryId
                    ? String(offers.filterByCategoryId)
                    : ""
                }
                options={[
                  { value: "", label: t.common.all },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                ]}
              />
            </Field>
          )}
        </div>

        {method === "manual" && (
          <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
            <Field label={t.settings.selectedProducts}>
              <div className="mt-1 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-[var(--radius-md)] border p-3">
                {products.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="selectedProductIds"
                      value={p.id}
                      defaultChecked={offers?.selectedProductIds.includes(p.id)}
                      className="accent-[var(--primary)]"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t.settings.selectedRentals}>
              <div className="mt-1 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-[var(--radius-md)] border p-3">
                {rentals.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="selectedRentalPackageIds"
                      value={r.id}
                      defaultChecked={offers?.selectedRentalPackageIds.includes(r.id)}
                      className="accent-[var(--primary)]"
                    />
                    <span className="truncate">{r.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}

        <div className="mt-4">
          <Toggle name="isActive" label={t.settings.pageEnabled} defaultChecked={offers?.isActive ?? false} />
        </div>
        <FormFooter state={state} label={t.settings.saveOffers} />
      </form>
    </SectionCard>
  );
}
