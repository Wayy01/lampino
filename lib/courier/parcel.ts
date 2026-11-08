// Parcel assembly in canonical units (grams + millimetres). Order lines carry
// per-item physical dimensions (variant → product → store fallback); this
// module resolves those and combines them into a single parcel, mirroring how
// the reference (aminterra) seeds the shipment drawer: weight is additive,
// dimensions are a footprint (the max of each axis) with the items stacked along
// the shortest axis. The result is a *starting estimate* the operator can edit
// before the waybill is created — the catalog stays the source of item truth,
// the parcel is finalized at ship time.

export type Dims = {
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
};

/** Store-wide per-item fallback, used when a line carries no size of its own. */
export type DimFallback = Dims;

type NullableDims = {
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
};

/**
 * Resolve one line's item dimensions: the variant's value, else the product's,
 * else the store fallback — independently per field.
 */
export function resolveItemDims(
  variant: NullableDims | null,
  product: NullableDims,
  fallback: DimFallback,
): Dims {
  const pick = (
    v: number | null | undefined,
    p: number | null | undefined,
    f: number,
  ): number => (v ?? p ?? f);
  return {
    weightG: pick(variant?.weightGrams, product.weightGrams, fallback.weightG),
    lengthMm: pick(variant?.lengthMm, product.lengthMm, fallback.lengthMm),
    widthMm: pick(variant?.widthMm, product.widthMm, fallback.widthMm),
    heightMm: pick(variant?.heightMm, product.heightMm, fallback.heightMm),
  };
}

export type ParcelLine = Dims & { quantity: number };

/**
 * Combine order lines into one parcel.
 * - weight: Σ (item weight × quantity)
 * - dimensions: footprint = max of each axis across items; the total item count
 *   is stacked along the *shortest* of those three axes.
 * Returns the store fallback unchanged when there are no lines.
 */
export function assembleParcel(lines: ParcelLine[], fallback: DimFallback): Dims {
  if (lines.length === 0) return { ...fallback };

  const maxW = Math.max(...lines.map((l) => l.widthMm));
  const maxL = Math.max(...lines.map((l) => l.lengthMm));
  const maxH = Math.max(...lines.map((l) => l.heightMm));
  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const weightG = lines.reduce((sum, l) => sum + l.weightG * l.quantity, 0);

  // Stack along the smallest footprint axis so the parcel grows the least.
  const axes = [
    { key: "w" as const, value: maxW },
    { key: "l" as const, value: maxL },
    { key: "h" as const, value: maxH },
  ].sort((a, b) => a.value - b.value);
  const stack = axes[0].key;

  return {
    weightG,
    widthMm: stack === "w" ? maxW * totalQty : maxW,
    lengthMm: stack === "l" ? maxL * totalQty : maxL,
    heightMm: stack === "h" ? maxH * totalQty : maxH,
  };
}

/** Nova Post uses g/mm natively — canonical dims pass straight through. */
export function toNovaPostUnits(d: Dims): Dims {
  return {
    weightG: Math.max(1, Math.round(d.weightG)),
    lengthMm: Math.max(1, Math.round(d.lengthMm)),
    widthMm: Math.max(1, Math.round(d.widthMm)),
    heightMm: Math.max(1, Math.round(d.heightMm)),
  };
}

/** Fan Courier uses kg/cm — convert from canonical grams/millimetres. */
export function toFanCourierUnits(d: Dims): {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
} {
  return {
    weightKg: Math.max(0.1, Math.round(d.weightG) / 1000),
    lengthCm: Math.max(1, Math.round(d.lengthMm / 10)),
    widthCm: Math.max(1, Math.round(d.widthMm / 10)),
    heightCm: Math.max(1, Math.round(d.heightMm / 10)),
  };
}
