"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import type { RentalPackage, RentalPackageVariant } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { formatPrice, pick, cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
  submitRentalApplication,
  type RentalApplicationError,
} from "@/lib/actions/rentals";

const EASE = [0.22, 1, 0.36, 1] as const;

const EVENT_TYPES = [
  "wedding",
  "corporate",
  "birthday",
  "private",
  "other",
] as const;

// The rental booking flow: a custom event-request form that creates a
// RentalApplication (its own "order system", separate from product orders).
export function RentalInquiryDrawer({
  open,
  onOpenChange,
  pkg,
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: RentalPackage;
  variant: RentalPackageVariant | null;
}) {
  const { lang, t } = useLang();
  const f = t.rental.form;

  const title = pick(lang, pkg.title_ro, pkg.title_ru);
  const variantLabel = variant
    ? [pick(lang, variant.name_ro, variant.name_ru), variant.size]
        .filter(Boolean)
        .join(" · ")
    : null;

  const basePrice = variant?.price ?? pkg.price;
  const reduced = variant ? variant.reducedPrice : pkg.reducedPrice;
  const price = reduced !== null && reduced < basePrice ? reduced : basePrice;

  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState<string>("wedding");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RentalApplicationError | null>(null);
  const [sent, setSent] = useState(false);

  // Reset transient state whenever the drawer reopens (render-time sync).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSent(false);
      setError(null);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await submitRentalApplication({
      rentalPackageId: pkg.id,
      rentalPackageVariantId: variant?.id ?? null,
      customerName: name,
      customerEmail: email || null,
      customerPhone: phone,
      eventType,
      eventDate,
      eventEndDate: eventEndDate || null,
      eventLocation: location,
      guestCount: Number(guestCount),
      additionalInfo: additionalInfo || null,
    });
    setPending(false);
    if (res.ok) setSent(true);
    else setError(res.error);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5 pr-14">
          <SheetTitle>{t.rental.requestQuote}</SheetTitle>
        </div>

        {sent ? (
          <SuccessView onClose={() => onOpenChange(false)} />
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-y-auto"
          >
            <div className="px-6 pt-4">
              <p className="text-sm text-muted-foreground">{f.subtitle}</p>

              {/* Package summary */}
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
                <div className="min-w-0">
                  <p className="font-display truncate text-lg tracking-tight">
                    {title}
                  </p>
                  {variantLabel && (
                    <p className="truncate text-xs text-muted-foreground">
                      {variantLabel}
                    </p>
                  )}
                </div>
                <span className="font-display shrink-0 text-lg tracking-tight">
                  {formatPrice(price)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 px-6 py-5">
              {/* Contact */}
              <div>
                <Label htmlFor="ra-name">{f.name}</Label>
                <Input
                  id="ra-name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ra-email">{f.email}</Label>
                <Input
                  id="ra-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ra-phone">{f.phone}</Label>
                <Input
                  id="ra-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* Event type */}
              <div>
                <Label>{f.eventType}</Label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEventType(key)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition-colors cursor-pointer",
                        eventType === key
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                      )}
                    >
                      {f.eventTypes[key]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label htmlFor="ra-date">{f.eventDate}</Label>
                  <Input
                    id="ra-date"
                    type="date"
                    required
                    min={today}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="ra-end">{f.eventEndDate}</Label>
                  <Input
                    id="ra-end"
                    type="date"
                    min={eventDate || today}
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Location + guests */}
              <div>
                <Label htmlFor="ra-location">{f.location}</Label>
                <Input
                  id="ra-location"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ra-guests">{f.guestCount}</Label>
                <Input
                  id="ra-guests"
                  type="number"
                  min={1}
                  required
                  inputMode="numeric"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="ra-info">{f.additionalInfo}</Label>
                <Textarea
                  id="ra-info"
                  rows={2}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                />
              </div>

              {/* Estimate */}
              <div className="mt-1 border-t border-border pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="label-mono text-muted-foreground">
                    {f.estimate}
                  </span>
                  <span className="font-display text-2xl tracking-tight">
                    {formatPrice(price)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  {t.rental.priceNote}
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-[var(--radius-sm)] bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {f.errors[error]}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="group w-full"
                disabled={pending}
              >
                {pending ? f.sending : f.submit}
                {!pending && (
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                )}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const f = t.rental.form;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-7 w-7" />
      </div>
      <h3 className="font-display mt-6 text-2xl tracking-tight">
        {f.successTitle}
      </h3>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        {f.successText}
      </p>
      <Button variant="outline" size="sm" className="mt-7" onClick={onClose}>
        {f.close}
      </Button>
    </motion.div>
  );
}
