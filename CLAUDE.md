# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
bun install                  # node_modules is not checked in
bun dev                      # next dev
bun run build                # next build
bun run lint                 # eslint (flat config, no `next lint`)
bunx prisma db push          # apply schema.prisma — there is no migrations/ dir
bunx prisma generate         # regenerate the client into lib/generated/prisma
bun prisma/seed.ts           # wipes and repopulates every table; prints admin/admin123
```

Env: `DATABASE_URL` (Postgres) and `ADMIN_SESSION_SECRET` (any random string — `session.ts` throws without it, and rotating it logs every admin out). No test suite exists.

The Prisma client is generated to `lib/generated/prisma` (not `@prisma/client`) and **is committed**. Import `Prisma` types from `@/lib/generated/prisma`; import the singleton from `@/lib/prisma`. ESLint ignores `lib/generated/**`.

## Architecture

Next.js 16 App Router + React 19, Tailwind v4 (CSS-only config in `app/globals.css` — no tailwind config file), Prisma/Postgres, no auth library.

**Two apps in one tree.** `app/[lang]/*` is the storefront and `app/admin/[lang]/(dashboard)/*` is the CMS. Each has its own root layout, its own dictionary, and its own component folder (`components/site/` vs `components/admin/`). They share `components/ui/`, `lib/prisma.ts`, `lib/i18n/routing.ts`, and the `lampino-lang` cookie.

**Locale is a URL segment, always.** `ro` (default) and `ru`; there is no third locale and no next-intl. `proxy.ts` (Next 16's renamed middleware) redirects any locale-less path to `/<locale>/...` or `/admin/<locale>/...`, detecting from the cookie then `Accept-Language`. Never build a URL by hand — use `localePath`, `shopHref`, `productHref`, `rentalHref` from `lib/i18n/routing.ts`, or `adminHref`/`useAdminLang().href` on the admin side.

**Translations are TypeScript objects, not JSON.** Storefront strings live in `lib/i18n/dictionaries.ts` (`ro` object typed, `ru: Dict` mirrors it), admin strings in `lib/admin/i18n.ts` (same pattern, `AdminDict`). Adding a key to `ro` and not `ru` is a type error — that's the intended guard. Read them in client components via `useT()` / `useAdminT()`; in server components and server actions call `getAdminDict(lang)` or index `dictionaries[lang]`.

**Content is bilingual at the column level.** Models carry `name_ro`/`name_ru`, `description_ro`/`description_ru`, etc. Use `pick(lang, ro, ru)` from `lib/utils.ts` to select. Server actions read the submitting locale from a hidden `_lang` form field via `langFromForm(fd)` so validation errors come back translated.

**Read path — `lib/data/*`.** Every storefront page fetches through `lib/data/{products,rentals,categories,settings}.ts`, which query Prisma and serialize to the plain view models in `lib/types.ts`: `Decimal` → `number`, relations flattened, `specifications` run through `normalizeSpecs`. Pages and components never touch `prisma` directly, and never receive a `Decimal`. Storefront pages set `export const dynamic = "force-dynamic"`.

> `lib/seed-catalog.ts` is the seed source and nothing else — `prisma/seed.ts` is its only importer. No storefront or admin code reads it.

**Write path — server actions.** Storefront: `lib/actions/rentals.ts` (a rental inquiry creates a `RentalApplication`) and `lib/actions/orders.ts` (cart/buy-now checkout creates an `Order` + `OrderItem` rows). Admin: `lib/admin/actions/*.ts`, each action starting with `await requireAdmin(lang)`, ending with `revalidatePath("/admin/[lang]/...", "page")` — note the literal bracket segments — and returning `{ ok } | { error }` for `useActionState`. Complex sub-collections (images, videos, variants, specs) are serialized to hidden JSON form fields and parsed back with the payload types exported alongside the action.

**Product checkout creates a real `Order`.** Cart checkout and buy-now both submit to `submitOrder` (`lib/actions/orders.ts`), which resolves prices/stock from the DB — never the client — and writes `Order` + `OrderItem` rows with status `"pending"`, the same as an admin-created order. Nothing is sent to WhatsApp on checkout; the WhatsApp links elsewhere on the storefront (product/rental detail pages) are a separate, optional "ask us a question" contact channel, unrelated to placing an order. The cart itself lives in `localStorage`, read through `useSyncExternalStore` in `lib/cart/provider.tsx`; the root layout passes the full catalog in so stored ids can rehydrate with live prices.

**Admin auth is hand-rolled.** HMAC-signed payload in an httpOnly `lampino-admin` cookie (`lib/admin/session.ts`) — no session table, no per-request DB hit. Passwords are Node `scrypt`, stored as `scrypt:<salt>:<hash>` (`lib/admin/password.ts`). `requireAdmin` guards the `(dashboard)` layout and every admin action.

**Uploads go to the local disk.** `lib/admin/actions/upload.ts` writes to `public/uploads/{images,videos}/` (gitignored). Limits in `lib/admin/media.ts`; `next.config.ts` raises the server-action body limit to 200mb for video. Remote images are restricted to the Unsplash hostnames in `next.config.ts`.

**`specifications` is a Json column with two shapes.** Canonical: `{ [id]: { label_ro, label_ru, value_ro, value_ru } }`. Legacy flat: `{ [key]: "value" }`, upgraded on read by `normalizeSpecs` (`lib/specs.ts`, storefront) and `specsFromJson` (`lib/admin/specs.ts`, admin). Catalog facets in `lib/filters.ts` classify the raw spec strings (`colorTemp`, `base`, `lumens`) into fixed buckets and only surface buckets that occur in the data.

**Canonical detail URLs** are `/<lang>/product/<id>/<slug>` and `/<lang>/rental-package/<id>/<slug>`. The id is the source of truth; the slug is decorative and a mismatch redirects to the canonical form.

## Conventions

- `components/ui/` is a small local shadcn-style set (cva + `cn`), not a full install. `components/admin/` is a deliberately narrow kit — one `DataTable`, one `SectionCard`, one set of `form-controls` — reuse them rather than styling a new table.
- Theme colors are CSS variables in `:root` mapped through `@theme inline`; use the semantic Tailwind classes (`bg-surface`, `text-muted-foreground`, `border-border`), not raw hex.
- Money is stored as `Decimal(10,2)`, rendered with `formatPrice` (lei, no decimals). Convert with `num()` from `lib/admin/serialize.ts` before it crosses into a client component.
