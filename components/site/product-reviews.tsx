"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "@/lib/actions/reviews";
import type { ProductReviews as ReviewsData } from "@/lib/data/reviews";
import { useLang } from "@/lib/i18n/provider";
import { fill } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="text-primary">
      {"★★★★★".slice(0, Math.round(rating))}
      <span className="text-foreground/20">{"★★★★★".slice(Math.round(rating))}</span>
    </span>
  );
}

/**
 * Approved reviews (in the server HTML, like the rest of the page) and the
 * form for a new one, which waits for moderation before it shows up.
 */
export function ProductReviews({ productId, data }: { productId: number; data: ReviewsData }) {
  const { lang, t } = useLang();
  const r = t.reviews;
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(submitReview, null);
  const [rating, setRating] = useState(0);
  const dateFormat = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section id="reviews" className="mx-auto max-w-[1400px] px-5 pb-20 sm:px-8">
      <div className="border-t border-border pt-14">
        <div className="label-mono text-primary">{r.kicker}</div>
        <h2 className="font-display mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-0.02em]">
          {r.title}
        </h2>
        {data.count > 0 && (
          <p className="mt-4 flex items-center gap-3 text-lg">
            <Stars rating={data.average} label={fill(r.stars, { n: data.average })} />
            <span className="text-muted-foreground">
              {fill(data.count === 1 ? r.summaryOne : r.summary, {
                avg: data.average,
                count: data.count,
              })}
            </span>
          </p>
        )}

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          {data.reviews.length === 0 ? (
            <p className="text-muted-foreground">{r.empty}</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {data.reviews.map((review) => (
                <li key={review.id} className="py-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars rating={review.rating} label={fill(r.stars, { n: review.rating })} />
                    <span className="font-medium">{review.authorName}</span>
                    <time dateTime={review.createdAt} className="text-sm text-muted-foreground">
                      {dateFormat.format(new Date(review.createdAt))}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/80">{review.body}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
            <h3 className="font-display text-2xl font-light">{r.formTitle}</h3>
            {state?.ok ? (
              <p role="status" className="mt-4 text-foreground/80">{r.sent}</p>
            ) : (
              <form action={formAction} className="mt-5 flex flex-col gap-4">
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="_lang" value={lang} />
                {/* Honeypot: hidden from people, filled by bots. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                <fieldset>
                  <legend className="label-mono mb-2 text-muted-foreground">{r.rating}</legend>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="cursor-pointer">
                        <input
                          type="radio"
                          name="rating"
                          value={n}
                          required
                          checked={rating === n}
                          onChange={() => setRating(n)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "text-3xl leading-none transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary",
                            n <= rating ? "text-primary" : "text-foreground/20 hover:text-primary/60",
                          )}
                        >
                          ★
                        </span>
                        <span className="sr-only">{fill(r.stars, { n })}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <Label htmlFor="review-name">{r.name}</Label>
                  <Input id="review-name" name="authorName" required maxLength={80} autoComplete="name" />
                </div>
                <div>
                  <Label htmlFor="review-body">{r.body}</Label>
                  <Textarea id="review-body" name="body" required minLength={10} maxLength={2000} rows={4} />
                </div>
                {state && !state.ok && (
                  <p role="alert" className="text-sm text-red-700">{r.errors[state.error]}</p>
                )}
                <Button type="submit" disabled={pending} className="self-start">
                  {r.submit}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
