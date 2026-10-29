"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveCategorySeo, type CategoryActionState } from "@/lib/admin/actions/categories";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { SectionCard } from "@/components/admin/section-card";
import { MediaField } from "@/components/admin/media";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  ActionNotice,
  AdminForm,
  Field,
  LangField,
  SubmitButton,
  TextArea,
  TextInput,
} from "@/components/admin/form-controls";
import type { CategoryLandingCopy, FaqItem, Locale } from "@/lib/types";

export type CategorySeoFormData = {
  id: number;
  urlSlug_ro: string;
  urlSlug_ru: string;
  /** What the slug is when the override is empty — shown as the placeholder. */
  defaultSlug_ro: string;
  defaultSlug_ru: string;
  ro: CategoryLandingCopy;
  ru: CategoryLandingCopy;
  ogImageUrl: string;
};

/** Question/answer rows, posted as one hidden JSON field. */
function FaqEditor({ name, defaultValue }: { name: string; defaultValue: FaqItem[] }) {
  const t = useAdminT().categories.seo;
  const [rows, setRows] = useState<FaqItem[]>(defaultValue);
  const update = (i: number, patch: Partial<FaqItem>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 rounded-[var(--radius-md)] border p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <TextInput
              aria-label={t.faqQuestion}
              placeholder={t.faqQuestion}
              value={row.q}
              onChange={(e) => update(i, { q: e.target.value })}
            />
            <TextArea
              aria-label={t.faqAnswer}
              placeholder={t.faqAnswer}
              rows={3}
              value={row.a}
              onChange={(e) => update(i, { a: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
            aria-label={t.faqRemove}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, { q: "", a: "" }])}
        className="flex h-9 cursor-pointer items-center gap-2 self-start rounded-[var(--radius-md)] border px-3 text-sm transition-colors hover:bg-foreground/[0.04]"
      >
        <Plus className="h-4 w-4" />
        {t.faqAdd}
      </button>
    </div>
  );
}

function LanguageSection({ lang, data }: { lang: Locale; data: CategorySeoFormData }) {
  const t = useAdminT().categories.seo;
  const copy = data[lang];
  const id = (f: string) => `cat_${f}_${lang}`;
  return (
    <SectionCard title={lang === "ro" ? t.langRo : t.langRu}>
      <div className="flex flex-col gap-4">
        <Field label={t.urlSlug} htmlFor={id("slug")} hint={t.urlSlugHint}>
          <TextInput
            id={id("slug")}
            name={`urlSlug_${lang}`}
            defaultValue={lang === "ro" ? data.urlSlug_ro : data.urlSlug_ru}
            placeholder={lang === "ro" ? data.defaultSlug_ro : data.defaultSlug_ru}
            className="font-mono"
          />
        </Field>
        <Field label={t.seoTitle} htmlFor={id("title")} hint={t.seoTitleHint}>
          <TextInput id={id("title")} name={`seoTitle_${lang}`} defaultValue={copy.seoTitle} maxLength={120} />
        </Field>
        <Field label={t.seoDescription} htmlFor={id("desc")} hint={t.seoDescriptionHint}>
          <TextArea id={id("desc")} name={`seoDescription_${lang}`} defaultValue={copy.seoDescription} rows={3} maxLength={300} />
        </Field>
        <Field label={t.h1} htmlFor={id("h1")} hint={t.h1Hint}>
          <TextInput id={id("h1")} name={`h1_${lang}`} defaultValue={copy.h1} maxLength={120} />
        </Field>
        <Field label={t.intro} htmlFor={id("intro")} hint={t.introHint}>
          <TextArea id={id("intro")} name={`intro_${lang}`} defaultValue={copy.intro} rows={4} />
        </Field>
        <Field label={t.body} htmlFor={id("body")} hint={t.bodyHint}>
          <RichTextEditor id={id("body")} name={`body_${lang}`} defaultValue={copy.body} />
        </Field>
        <Field label={t.faq}>
          <FaqEditor name={`faq_${lang}`} defaultValue={copy.faq} />
        </Field>
      </div>
    </SectionCard>
  );
}

export function CategorySeoForm({ data }: { data: CategorySeoFormData }) {
  const t = useAdminT().categories.seo;
  const [state, formAction] = useActionState<CategoryActionState, FormData>(
    saveCategorySeo.bind(null, data.id),
    null,
  );

  return (
    <AdminForm action={formAction} className="flex flex-col gap-6">
      <LangField />
      <div className="grid gap-6 xl:grid-cols-2">
        <LanguageSection lang="ro" data={data} />
        <LanguageSection lang="ru" data={data} />
      </div>
      <SectionCard>
        <Field label={t.ogImage} htmlFor="cat_og" hint={t.ogImageHint}>
          <MediaField id="cat_og" name="ogImageUrl" defaultValue={data.ogImageUrl} accept="image" />
        </Field>
      </SectionCard>
      <ActionNotice state={state} />
      <div className="flex justify-end">
        <SubmitButton>{t.save}</SubmitButton>
      </div>
    </AdminForm>
  );
}
