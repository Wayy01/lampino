"use server";

// Public rental-booking flow. Unlike products (which go through the cart /
// WhatsApp), a rental is a *request*: it creates a `RentalApplication` row with
// the event details, status "pending", for the team to follow up on.
import { prisma } from "@/lib/prisma";

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

export type RentalApplicationResult = { ok: true } | { ok: false; error: string };

const EVENT_TYPES = ["wedding", "corporate", "birthday", "private", "other"];
// Email is optional on the form; when the customer leaves it blank we store the
// shop's own address so the record stays valid and the team can still reply.
const FALLBACK_EMAIL = "contact@lampino.md";

export async function submitRentalApplication(
  input: RentalApplicationInput,
): Promise<RentalApplicationResult> {
  try {
    const name = input.customerName?.trim();
    const phone = input.customerPhone?.trim();
    const eventType = input.eventType?.trim();
    const location = input.eventLocation?.trim();
    const guestCount = Math.floor(Number(input.guestCount));
    const eventDate = new Date(input.eventDate);
    const eventEndDate = input.eventEndDate ? new Date(input.eventEndDate) : null;

    if (!name || !phone) {
      return { ok: false, error: "invalid_contact" };
    }
    if (!eventType || !EVENT_TYPES.includes(eventType)) {
      return { ok: false, error: "invalid_event_type" };
    }
    if (!location) return { ok: false, error: "invalid_location" };
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      return { ok: false, error: "invalid_guests" };
    }
    if (Number.isNaN(eventDate.getTime())) {
      return { ok: false, error: "invalid_date" };
    }
    if (
      eventEndDate &&
      (Number.isNaN(eventEndDate.getTime()) || eventEndDate < eventDate)
    ) {
      return { ok: false, error: "invalid_end_date" };
    }

    const [pkg, contact] = await Promise.all([
      prisma.rentalPackage.findFirst({
        where: { id: input.rentalPackageId, isActive: true },
        include: { variants: true },
      }),
      prisma.contactSettings.findFirst({ where: { isActive: true } }),
    ]);
    if (!pkg) return { ok: false, error: "package_not_found" };

    const customerEmail =
      input.customerEmail?.trim() || contact?.email?.trim() || FALLBACK_EMAIL;

    // Price is resolved server-side from the package/variant — never the client.
    let rentalPackageVariantId: number | null = null;
    let totalPrice = pkg.reducedPrice ?? pkg.price;
    if (input.rentalPackageVariantId != null) {
      const variant = pkg.variants.find(
        (v) => v.id === input.rentalPackageVariantId,
      );
      if (variant) {
        rentalPackageVariantId = variant.id;
        totalPrice = variant.reducedPrice ?? variant.price;
      }
    }

    await prisma.rentalApplication.create({
      data: {
        customerName: name,
        customerEmail,
        customerPhone: phone,
        eventType,
        eventDate,
        eventEndDate,
        eventLocation: location,
        guestCount,
        additionalInfo: input.additionalInfo?.trim() || null,
        rentalPackageId: pkg.id,
        rentalPackageVariantId,
        status: "pending",
        totalPrice,
      },
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "server_error" };
  }
}
