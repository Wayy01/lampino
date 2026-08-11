"use client";

import { useActionState } from "react";
import { Megaphone, PanelsTopLeft, SlidersHorizontal } from "lucide-react";
import {
  updateHero,
  updateHomepage,
  updateBanner,
  type HomepageActionState,
} from "@/lib/admin/actions/homepage";
import { useAdminT } from "@/lib/admin/i18n-provider";
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

export type HeroData = {
  leftHeading_ro: string;
  leftHeading_ru: string;
  leftButtonText_ro: string;
  leftButtonText_ru: string;
  leftButtonUrl: string;
  leftImageUrl: string | null;
  rightImageUrl: string | null;
  leftMediaUrl: string | null;
  leftMediaType: string;
  rightMediaUrl: string | null;
  rightMediaType: string;
  isActive: boolean;
};

export type HomepageData = {
  featuredCategoryIds: number[];
  maxCategories: number;
  featuredProductsCategoryId: number | null;
  featuredRentalsCategoryId: number | null;
  isActive: boolean;
  welcomeHeading_ro: string;
  welcomeHeading_ru: string;
  welcomeDescription_ro: string;
  welcomeDescription_ru: string;
  welcomeButtonText_ro: string;
  welcomeButtonText_ru: string;
  welcomeButtonUrl: string;
  categoryHeading_ro: string;
  categoryHeading_ru: string;
  productHeading_ro: string;
  productHeading_ru: string;
  rentalHeading_ro: string;
  rentalHeading_ru: string;
};

export type BannerData = {
  message_ro: string;
  message_ru: string;
  ctaText_ro: string;
  ctaText_ru: string;
  ctaLink: string;
  isActive: boolean;
  showOnDesktop: boolean;
  showOnMobile: boolean;
  backgroundColor: string;
  textColor: string;
};

type Option = { id: number; name: string };

function FormFooter({
  state,
  label,
}: {
  state: HomepageActionState;
  label: string;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
      <SubmitButton>{label}</SubmitButton>
      <ActionNotice state={state} />
    </div>
  );
}

export function HeroForm({ hero }: { hero: HeroData | null }) {
  const t = useAdminT();
  const [state, formAction] = useActionState<HomepageActionState, FormData>(
    updateHero,
    null,
  );

  const mediaTypeOptions = [
    { value: "image", label: t.common.image },
    { value: "video", label: t.common.video },
  ];

  return (
    <SectionCard
      title={t.homepage.hero}
      icon={<PanelsTopLeft className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.homepage.headingRo} htmlFor="hero_h_ro">
            <TextInput id="hero_h_ro" name="leftHeading_ro" defaultValue={hero?.leftHeading_ro} required />
          </Field>
          <Field label={t.homepage.headingRu} htmlFor="hero_h_ru">
            <TextInput id="hero_h_ru" name="leftHeading_ru" defaultValue={hero?.leftHeading_ru} required />
          </Field>
          <Field label={t.homepage.buttonTextRo} htmlFor="hero_bt_ro">
            <TextInput id="hero_bt_ro" name="leftButtonText_ro" defaultValue={hero?.leftButtonText_ro} />
          </Field>
          <Field label={t.homepage.buttonTextRu} htmlFor="hero_bt_ru">
            <TextInput id="hero_bt_ru" name="leftButtonText_ru" defaultValue={hero?.leftButtonText_ru} />
          </Field>
          <Field label={t.homepage.buttonUrl} htmlFor="hero_burl" className="sm:col-span-2">
            <TextInput id="hero_burl" name="leftButtonUrl" defaultValue={hero?.leftButtonUrl ?? "/magazin"} className="font-mono" />
          </Field>
          <Field label={t.homepage.leftImageUrl} htmlFor="hero_limg">
            <MediaField id="hero_limg" name="leftImageUrl" defaultValue={hero?.leftImageUrl ?? ""} accept="image" />
          </Field>
          <Field label={t.homepage.rightImageUrl} htmlFor="hero_rimg">
            <MediaField id="hero_rimg" name="rightImageUrl" defaultValue={hero?.rightImageUrl ?? ""} accept="image" />
          </Field>
          <Field label={t.homepage.leftMediaOverride} htmlFor="hero_lmedia" hint={t.homepage.mediaHint}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <MediaField id="hero_lmedia" name="leftMediaUrl" defaultValue={hero?.leftMediaUrl ?? ""} accept="media" className="min-w-0 flex-1" />
              <AdminSelect
                name="leftMediaType"
                defaultValue={hero?.leftMediaType ?? "image"}
                options={mediaTypeOptions}
                ariaLabel={t.homepage.leftMediaOverride}
                className="sm:w-32 sm:shrink-0"
              />
            </div>
          </Field>
          <Field label={t.homepage.rightMediaOverride} htmlFor="hero_rmedia" hint={t.homepage.mediaHint}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <MediaField id="hero_rmedia" name="rightMediaUrl" defaultValue={hero?.rightMediaUrl ?? ""} accept="media" className="min-w-0 flex-1" />
              <AdminSelect
                name="rightMediaType"
                defaultValue={hero?.rightMediaType ?? "image"}
                options={mediaTypeOptions}
                ariaLabel={t.homepage.rightMediaOverride}
                className="sm:w-32 sm:shrink-0"
              />
            </div>
          </Field>
        </div>
        <div className="mt-4">
          <Toggle name="isActive" label={t.homepage.heroVisible} defaultChecked={hero?.isActive ?? true} />
        </div>
        <FormFooter state={state} label={t.homepage.saveHero} />
      </form>
    </SectionCard>
  );
}

export function HomepageSettingsForm({
  settings,
  categories,
}: {
  settings: HomepageData | null;
  categories: Option[];
}) {
  const t = useAdminT();
  const [state, formAction] = useActionState<HomepageActionState, FormData>(
    updateHomepage,
    null,
  );

  const categoryOptions = [
    { value: "", label: t.homepage.allCategories },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <SectionCard
      title={t.homepage.sections}
      icon={<SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.homepage.welcomeHeadingRo} htmlFor="hs_wh_ro">
            <TextInput id="hs_wh_ro" name="welcomeHeading_ro" defaultValue={settings?.welcomeHeading_ro} required />
          </Field>
          <Field label={t.homepage.welcomeHeadingRu} htmlFor="hs_wh_ru">
            <TextInput id="hs_wh_ru" name="welcomeHeading_ru" defaultValue={settings?.welcomeHeading_ru} required />
          </Field>
          <Field label={t.homepage.welcomeDescriptionRo} htmlFor="hs_wd_ro" className="sm:col-span-2">
            <TextArea id="hs_wd_ro" name="welcomeDescription_ro" rows={3} defaultValue={settings?.welcomeDescription_ro} />
          </Field>
          <Field label={t.homepage.welcomeDescriptionRu} htmlFor="hs_wd_ru" className="sm:col-span-2">
            <TextArea id="hs_wd_ru" name="welcomeDescription_ru" rows={3} defaultValue={settings?.welcomeDescription_ru} />
          </Field>
          <Field label={t.homepage.welcomeButtonRo} htmlFor="hs_wb_ro">
            <TextInput id="hs_wb_ro" name="welcomeButtonText_ro" defaultValue={settings?.welcomeButtonText_ro} />
          </Field>
          <Field label={t.homepage.welcomeButtonRu} htmlFor="hs_wb_ru">
            <TextInput id="hs_wb_ru" name="welcomeButtonText_ru" defaultValue={settings?.welcomeButtonText_ru} />
          </Field>
          <Field label={t.homepage.welcomeButtonUrl} htmlFor="hs_wurl" className="sm:col-span-2">
            <TextInput id="hs_wurl" name="welcomeButtonUrl" defaultValue={settings?.welcomeButtonUrl ?? "/magazin"} className="font-mono" />
          </Field>

          <Field label={t.homepage.categoriesHeadingRo} htmlFor="hs_ch_ro">
            <TextInput id="hs_ch_ro" name="categoryHeading_ro" defaultValue={settings?.categoryHeading_ro} />
          </Field>
          <Field label={t.homepage.categoriesHeadingRu} htmlFor="hs_ch_ru">
            <TextInput id="hs_ch_ru" name="categoryHeading_ru" defaultValue={settings?.categoryHeading_ru} />
          </Field>
          <Field label={t.homepage.productsHeadingRo} htmlFor="hs_ph_ro">
            <TextInput id="hs_ph_ro" name="productHeading_ro" defaultValue={settings?.productHeading_ro} />
          </Field>
          <Field label={t.homepage.productsHeadingRu} htmlFor="hs_ph_ru">
            <TextInput id="hs_ph_ru" name="productHeading_ru" defaultValue={settings?.productHeading_ru} />
          </Field>
          <Field label={t.homepage.rentalsHeadingRo} htmlFor="hs_rh_ro">
            <TextInput id="hs_rh_ro" name="rentalHeading_ro" defaultValue={settings?.rentalHeading_ro} />
          </Field>
          <Field label={t.homepage.rentalsHeadingRu} htmlFor="hs_rh_ru">
            <TextInput id="hs_rh_ru" name="rentalHeading_ru" defaultValue={settings?.rentalHeading_ru} />
          </Field>
        </div>

        <div className="mt-5 border-t pt-5">
          <Field
            label={t.homepage.featuredCategories}
            hint={t.homepage.featuredCategoriesHint}
          >
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="featuredCategoryIds"
                    value={c.id}
                    defaultChecked={settings?.featuredCategoryIds.includes(c.id)}
                    className="accent-[var(--primary)]"
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={t.homepage.maxCategories} htmlFor="hs_max">
              <TextInput id="hs_max" name="maxCategories" type="number" min="1" max="12" inputMode="numeric" defaultValue={settings?.maxCategories ?? 3} />
            </Field>
            <Field label={t.homepage.featuredProductsFrom} htmlFor="hs_fpc">
              <AdminSelect
                id="hs_fpc"
                name="featuredProductsCategoryId"
                defaultValue={
                  settings?.featuredProductsCategoryId
                    ? String(settings.featuredProductsCategoryId)
                    : ""
                }
                options={categoryOptions}
              />
            </Field>
            <Field label={t.homepage.featuredRentalsFrom} htmlFor="hs_frc">
              <AdminSelect
                id="hs_frc"
                name="featuredRentalsCategoryId"
                defaultValue={
                  settings?.featuredRentalsCategoryId
                    ? String(settings.featuredRentalsCategoryId)
                    : ""
                }
                options={categoryOptions}
              />
            </Field>
          </div>
        </div>

        <div className="mt-4">
          <Toggle name="isActive" label={t.homepage.sectionsVisible} defaultChecked={settings?.isActive ?? true} />
        </div>
        <FormFooter state={state} label={t.homepage.saveSections} />
      </form>
    </SectionCard>
  );
}

export function BannerForm({ banner }: { banner: BannerData | null }) {
  const t = useAdminT();
  const [state, formAction] = useActionState<HomepageActionState, FormData>(
    updateBanner,
    null,
  );

  return (
    <SectionCard
      title={t.homepage.promoBanner}
      icon={<Megaphone className="h-4 w-4" strokeWidth={1.75} />}
    >
      <form action={formAction}>
        <LangField />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.homepage.messageRo} htmlFor="pb_m_ro">
            <TextInput id="pb_m_ro" name="message_ro" defaultValue={banner?.message_ro} required />
          </Field>
          <Field label={t.homepage.messageRu} htmlFor="pb_m_ru">
            <TextInput id="pb_m_ru" name="message_ru" defaultValue={banner?.message_ru} required />
          </Field>
          <Field label={t.homepage.ctaTextRo} htmlFor="pb_c_ro">
            <TextInput id="pb_c_ro" name="ctaText_ro" defaultValue={banner?.ctaText_ro} />
          </Field>
          <Field label={t.homepage.ctaTextRu} htmlFor="pb_c_ru">
            <TextInput id="pb_c_ru" name="ctaText_ru" defaultValue={banner?.ctaText_ru} />
          </Field>
          <Field label={t.homepage.ctaLink} htmlFor="pb_link" className="sm:col-span-2">
            <TextInput id="pb_link" name="ctaLink" defaultValue={banner?.ctaLink ?? "/oferte-speciale"} className="font-mono" />
          </Field>
          <Field label={t.homepage.background} htmlFor="pb_bg">
            <input
              id="pb_bg"
              name="backgroundColor"
              type="color"
              defaultValue={banner?.backgroundColor ?? "#14110f"}
              className="h-10 w-14 cursor-pointer rounded-[var(--radius-sm)] border bg-background p-1"
            />
          </Field>
          <Field label={t.homepage.textColor} htmlFor="pb_fg">
            <input
              id="pb_fg"
              name="textColor"
              type="color"
              defaultValue={banner?.textColor ?? "#f6f4ef"}
              className="h-10 w-14 cursor-pointer rounded-[var(--radius-sm)] border bg-background p-1"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Toggle name="isActive" label={t.homepage.bannerEnabled} defaultChecked={banner?.isActive ?? false} />
          <Toggle name="showOnDesktop" label={t.homepage.showOnDesktop} defaultChecked={banner?.showOnDesktop ?? true} />
          <Toggle name="showOnMobile" label={t.homepage.showOnMobile} defaultChecked={banner?.showOnMobile ?? true} />
        </div>
        <FormFooter state={state} label={t.homepage.saveBanner} />
      </form>
    </SectionCard>
  );
}
