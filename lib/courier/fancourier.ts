// Fan Courier API client (server-only). Thin wrapper over the Moldova API used
// for the admin shipment flow: search cities, then create a waybill. Callers
// pass the (decrypted) API key — this module never reads the key store itself,
// so secret handling stays at the edge.
//
// Unlike Nova Post there is no token exchange: the `api_key` is sent as a form/
// query parameter on every request. There is a single environment (no sandbox).
// Requests are `application/x-www-form-urlencoded`; responses are JSON, usually
// wrapped in a `{ status, data, message, error }` envelope.

const BASE_URL = "https://app.fancourier.md/fan/API";
const TIMEOUT_MS = 30_000;

export type FanCourierConfig = {
  apiKey: string;
};

export class FanCourierError extends Error {
  constructor(
    public detail: string,
    public code?: string,
  ) {
    super(detail || "Fan Courier API error");
    this.name = "FanCourierError";
  }
}

/** Short, admin-readable reason — the envelope already carries a message. */
export function describeFanCourierError(err: FanCourierError): string {
  return err.detail?.trim() || (err.code ? `Fan Courier: ${err.code}` : "Fan Courier error");
}

type FcParams = Record<string, string | number>;

// One request. GET puts params in the query string; everything else posts them
// as a urlencoded form. The `api_key` is merged in on every call. Unwraps the
// `{ status, data }` envelope and throws `FanCourierError` on `status:"failed"`.
async function fcRequest(
  cfg: FanCourierConfig,
  operation: string,
  method: "GET" | "POST",
  params: FcParams,
): Promise<unknown> {
  const merged: FcParams = { api_key: cfg.apiKey, ...params };
  const url = `${BASE_URL}/${operation}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    if (method === "GET") {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) qs.append(k, String(v));
      res = await fetch(`${url}?${qs.toString()}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } else {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) form.append(k, String(v));
      res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: controller.signal,
      });
    }
  } catch (e) {
    throw new FanCourierError(
      e instanceof Error && e.name === "AbortError"
        ? "Fan Courier request timed out."
        : "Could not reach Fan Courier.",
    );
  } finally {
    clearTimeout(timer);
  }

  const decoded = (await res.json().catch(() => null)) as
    | { status?: string; data?: unknown; message?: unknown; error?: unknown }
    | unknown[]
    | null;

  if (decoded == null) {
    throw new FanCourierError(`Fan Courier returned an unexpected response for "${operation}".`);
  }

  // List endpoints return a bare array.
  if (Array.isArray(decoded)) {
    if (!res.ok) throw new FanCourierError(`Fan Courier request "${operation}" failed.`);
    return decoded;
  }

  const env = decoded as { status?: string; data?: unknown; message?: unknown; error?: unknown };
  if (env.status === "failed") {
    throw new FanCourierError(
      typeof env.message === "string" && env.message.trim()
        ? env.message.trim()
        : `Fan Courier request "${operation}" failed.`,
      typeof env.error === "string" ? env.error : undefined,
    );
  }
  if (!res.ok && env.status === undefined) {
    throw new FanCourierError(`Fan Courier request "${operation}" failed (HTTP ${res.status}).`);
  }
  return env.data ?? env;
}

// --- City lookup -------------------------------------------------------------

export type FanCourierCity = {
  country: string | null;
  province: string | null;
  name: string;
};

type RawCity = {
  country?: string;
  province?: string;
  name?: string;
  extra_km?: unknown;
};

// The full city list rarely changes; cache it per key for 24h so each keystroke
// filters a local list instead of hammering the API (mirrors aminterra).
type CityCacheEntry = { at: number; cities: FanCourierCity[] };
const cityCache = new Map<string, CityCacheEntry>();
const CITY_TTL_MS = 24 * 60 * 60 * 1000;

async function listCities(cfg: FanCourierConfig): Promise<FanCourierCity[]> {
  const cached = cityCache.get(cfg.apiKey);
  if (cached && Date.now() - cached.at < CITY_TTL_MS) return cached.cities;

  const raw = (await fcRequest(cfg, "list_cities", "GET", {})) as RawCity[];
  const cities = (Array.isArray(raw) ? raw : [])
    .filter((c): c is RawCity & { name: string } => typeof c?.name === "string" && c.name.trim() !== "")
    .map((c) => ({
      country: c.country ?? null,
      province: c.province ?? null,
      name: c.name.trim(),
    }));
  cityCache.set(cfg.apiKey, { at: Date.now(), cities });
  return cities;
}

/** Lowercase and strip diacritics so "Chișinău" matches the API's "Chisinau". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Search cities by free text, optionally scoped to a province. Filters the
 * cached list locally (name contains) and caps the result, like aminterra's
 * city autocomplete — but diacritic-insensitive, so a city seeded from the
 * order (Moldovan names carry diacritics) matches the API's ASCII list.
 */
export async function searchCities(
  cfg: FanCourierConfig,
  text: string,
  opts: { province?: string; limit?: number } = {},
): Promise<FanCourierCity[]> {
  const cities = await listCities(cfg);
  const needle = fold(text);
  if (!needle) return [];
  const province = opts.province ? fold(opts.province) : "";
  const matches = cities.filter(
    (c) =>
      fold(c.name).includes(needle) &&
      (!province || fold(c.province ?? "") === province),
  );
  return matches.slice(0, opts.limit ?? 30);
}

// --- Shipment creation (waybill) --------------------------------------------

/** One parcel in Fan Courier's native units (kg + cm). */
export type FanCourierParcel = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type FanCourierSenderInfo = {
  /** When true, use the account's default pickup address (local fields ignored). */
  useDefault: boolean;
  name: string;
  phone: string;
  email: string;
  county: string;
  city: string;
  street: string;
  nr: string;
  zipcode: string;
};

export type FanCourierRecipientInfo = {
  name: string;
  phone: string;
  email: string;
  county: string;
  city: string;
  street: string;
  nr: string;
  block: string;
  staircase: string;
  floor: string;
  flat: string;
  zipcode: string;
  extra: string;
};

export type FanCourierShipmentRequest = {
  serviceType: string;
  /** Who pays the delivery: the account holder (invoice), sender, or recipient. */
  payer: "client" | "sender" | "recipient";
  /** Shipment-level declared value (insurance). */
  declaredValue: number;
  /** When set, collect this amount on delivery (ramburs). */
  cod?: { amount: number; type: "cont" | "cash" | "instrumente_plata" } | null;
  content: string;
  comments: string;
  customerReference: string;
  sender: FanCourierSenderInfo;
  recipient: FanCourierRecipientInfo;
  parcels: FanCourierParcel[];
};

/**
 * Map the structured request to the exact `create_shipment` form body. Parcel 1
 * uses unsuffixed weight/length/width/height keys; parcels 2..N append their
 * 1-based index (`weight2`, `length2`, …), matching the Fan Courier contract.
 */
export function buildFanCourierShipmentBody(req: FanCourierShipmentRequest): FcParams {
  const body: FcParams = {
    type: "package",
    service_type: req.serviceType || "standard",
    cnt: req.parcels.length,
    payer: req.payer,
    insurance: req.declaredValue,
    content: req.content.slice(0, 255),
    comments: (req.comments || "").slice(0, 255),
    customer_reference: req.customerReference,
    to_country: "MD",
  };

  req.parcels.forEach((p, i) => {
    const sfx = i === 0 ? "" : String(i + 1);
    body[`weight${sfx}`] = p.weightKg;
    body[`length${sfx}`] = p.lengthCm;
    body[`width${sfx}`] = p.widthCm;
    body[`height${sfx}`] = p.heightCm;
  });

  if (req.cod && req.cod.amount > 0) {
    body.ramburs = req.cod.amount;
    body.ramburs_type = req.cod.type;
  }

  // Sender: the account default pickup address, or the stored sender fields.
  if (req.sender.useDefault) {
    body.use_default_from_address = "true";
  } else {
    body.from_name = req.sender.name;
    body.from_phone = req.sender.phone;
    body.from_email = req.sender.email;
    body.from_county = req.sender.county;
    body.from_city = req.sender.city;
    body.from_str = req.sender.street;
    body.from_nr = req.sender.nr;
    body.from_zipcode = req.sender.zipcode;
    body.from_country = "MD";
  }

  // Recipient (door-to-street). Empty parts are still sent as blanks.
  const r = req.recipient;
  body.to_name = r.name;
  body.to_phone = r.phone;
  body.to_email = r.email;
  body.to_county = r.county;
  body.to_city = r.city;
  body.to_str = r.street;
  body.to_nr = r.nr;
  body.to_bl = r.block;
  body.to_sc = r.staircase;
  body.to_et = r.floor;
  body.to_ap = r.flat;
  body.to_zipcode = r.zipcode;
  body.to_extra = r.extra;

  return body;
}

export type FanCourierShipmentResult = {
  number: string;
  /** The exact form body sent — stored on the Shipment for audit. */
  body: FcParams;
};

/**
 * Create a waybill. NOTE: this mints a REAL shipment in the Fan Courier account
 * — callers must gate it behind an explicit operator action. The AWB number is
 * read from the response's `no` field.
 */
export async function createShipment(
  cfg: FanCourierConfig,
  req: FanCourierShipmentRequest,
): Promise<FanCourierShipmentResult> {
  const body = buildFanCourierShipmentBody(req);
  const data = (await fcRequest(cfg, "create_shipment", "POST", body)) as
    | { no?: unknown; message?: unknown }
    | undefined;
  const no = data?.no;
  if (no === undefined || no === null || String(no).trim() === "") {
    throw new FanCourierError(
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : "Fan Courier did not return a waybill number.",
    );
  }
  return { number: String(no), body };
}
