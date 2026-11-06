"use server";

// Public rental-booking flow. Unlike products (which go through the cart /
// WhatsApp), a rental is a *request*: it creates a `RentalApplication` row with
// the event details, status "pending", for the team to follow up on.
import { bestActivePromotion, effectiveReducedPrice } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { sendNewRentalApplicationAlert } from "@/lib/telegram";
import { withinRateLimit } from "@/lib/rate-limit";

export type RentalApplicationInput = {
  rentalPackageId: number;
  rentalPackageVariantId: number | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  eventType: string;
  eventDate: string; // "YYYY-MM-DD"
  eventEndDate: string | null;
  eventLocation: string;
  guestCount: number;
  additionalInfo: string | null;
};

/** Every way a rental request can be refused; mapped to `t.rental.form.errors`. */
export type RentalApplicationError =
  | "invalid_contact"
  | "invalid_event_type"
  | "invalid_location"
  | "invalid_guests"
  | "invalid_date"
  | "invalid_end_date"
  | "package_not_found"
  | "invalid_email"
  | "invalid_variant"
  | "too_many_requests"
  | "server_error";

export type RentalApplicationResult =
  | { ok: true }
  | { ok: false; error: RentalApplicationError };

const EVENT_TYPES = ["wedding", "corporate", "birthday", "private", "other"];
// Email is optional on the form; when the customer leaves it blank we store the
// shop's own address so the record stays valid and the team can still reply.
const FALLBACK_EMAIL = "contact@lampino.md";

// Public input caps, matching the order checkout.
const MAX_NAME = 100;
const MAX_PHONE = 30;
const MAX_EMAIL = 254;
const MAX_LOCATION = 300;
const MAX_INFO = 2000;
const MAX_GUESTS = 100_000;
const PHONE_RE = /^\+?[\d\s().-]{6,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Today's date as "YYYY-MM-DD" in Moldova, where every event takes place. */
function todayInChisinau(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(new Date());
}

export async function submitRentalApplication(
  input: RentalApplicationInput,
): Promise<RentalApplicationResult> {
  try {
    const name = str(input.customerName);
    const phone = str(input.customerPhone);
    const email = str(input.customerEmail);
    const eventType = str(input.eventType);
    const location = str(input.eventLocation);
    const additionalInfo = str(input.additionalInfo).slice(0, MAX_INFO);
    const guestCount = Math.floor(Number(input.guestCount));
    const rawDate = str(input.eventDate);
    const rawEnd = str(input.eventEndDate);
    const eventDate = DATE_RE.test(rawDate) ? new Date(rawDate) : new Date(NaN);
    const eventEndDate = rawEnd
      ? DATE_RE.test(rawEnd)
        ? new Date(rawEnd)
        : new Date(NaN)
      : null;
    const digits = phone.replace(/\D/g, "").length;

    if (
      !name ||
      name.length > MAX_NAME ||
      phone.length > MAX_PHONE ||
      !PHONE_RE.test(phone) ||
      digits < 6 ||
      digits > 15
    ) {
      return { ok: false, error: "invalid_contact" };
    }
    if (email && (email.length > MAX_EMAIL || !EMAIL_RE.test(email))) {
      return { ok: false, error: "invalid_email" };
    }
    if (!eventType || !EVENT_TYPES.includes(eventType)) {
      return { ok: false, error: "invalid_event_type" };
    }
    if (!location || location.length > MAX_LOCATION) {
      return { ok: false, error: "invalid_location" };
    }
    if (!Number.isFinite(guestCount) || guestCount < 1 || guestCount > MAX_GUESTS) {
      return { ok: false, error: "invalid_guests" };
    }
    // ISO strings compare correctly as text, so a past date is simply "< today".
    if (Number.isNaN(eventDate.getTime()) || rawDate < todayInChisinau()) {
      return { ok: false, error: "invalid_date" };
    }
    if (
      eventEndDate &&
      (Number.isNaN(eventEndDate.getTime()) || eventEndDate < eventDate)
    ) {
      return { ok: false, error: "invalid_end_date" };
    }

    if (!Number.isInteger(input.rentalPackageId) || input.rentalPackageId < 1) {
      return { ok: false, error: "package_not_found" };
    }

    if (!(await withinRateLimit("rental", 5, 10 * 60_000))) {
      return { ok: false, error: "too_many_requests" };
    }

    const [pkg, contact] = await Promise.all([
      prisma.rentalPackage.findFirst({
        where: { id: input.rentalPackageId, isActive: true },
        include: {
          variants: true,
          promotions: { select: { startDate: true, endDate: true, discountPercent: true } },
        },
      }),
      prisma.contactSettings.findFirst({ where: { isActive: true } }),
    ]);
    if (!pkg) return { ok: false, error: "package_not_found" };

    const customerEmail = email || contact?.email?.trim() || FALLBACK_EMAIL;

    // Price is resolved server-side from the package/variant — never the client.
    let rentalPackageVariantId: number | null = null;
    // Same as the storefront: the best running promotion or manual reduced
    // price, whichever is lowest (lib/promotions.ts).
    const pct = bestActivePromotion(pkg.promotions)?.discountPercent ?? null;
    const quote = (price: Prisma.Decimal, reduced: Prisma.Decimal | null) => {
      const r = effectiveReducedPrice(Number(price), reduced === null ? null : Number(reduced), pct);
      return r === null ? price : new Prisma.Decimal(r);
    };
    let totalPrice = quote(pkg.price, pkg.reducedPrice);
    if (input.rentalPackageVariantId != null) {
      const variant = pkg.variants.find(
        (v) => v.id === input.rentalPackageVariantId,
      );
      // An unknown variant used to fall back to the base price silently; the
      // customer would be quoted for something they didn't pick.
      if (!variant) return { ok: false, error: "invalid_variant" };
      rentalPackageVariantId = variant.id;
      totalPrice = quote(variant.price, variant.reducedPrice);
    }

    const application = await prisma.rentalApplication.create({
      data: {
        customerName: name,
        customerEmail,
        customerPhone: phone,
        eventType,
        eventDate,
        eventEndDate,
        eventLocation: location,
        guestCount,
        additionalInfo: additionalInfo || null,
        rentalPackageId: pkg.id,
        rentalPackageVariantId,
        status: "pending",
        totalPrice,
      },
      include: {
        rentalPackage: { select: { title_ro: true } },
        rentalPackageVariant: { select: { name_ro: true } },
      },
    });

    sendNewRentalApplicationAlert(application).catch((err) =>
      console.error("Failed to send Telegram rental alert", application.id, err),
    );

    return { ok: true };
  } catch {
    return { ok: false, error: "server_error" };
  }
}
