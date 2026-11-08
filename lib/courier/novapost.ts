// Nova Post API client (server-only). Thin wrapper over the v1.0 REST API used
// for the admin shipment flow: authenticate, then search settlements/divisions/
// streets. Callers pass the (decrypted) API key and sandbox flag — this module
// never reads the key store itself, so secret handling stays at the edge.
//
// Auth is a two-step JWT: GET clients/authorization?apiKey=<key> returns a JWT
// that is sent raw in the `Authorization` header (no "Bearer " prefix). Tokens
// are cached per-key in memory and refreshed on expiry or a 401.

import type { CancelResult } from "./cancel";

const PROD = "https://api.novapost.com/v.1.0/";
const SANDBOX = "https://api-stage.novapost.pl/v.1.0/";
const TIMEOUT_MS = 30_000;

// Single fetch wrapper: a 30s timeout (parity with the Fan Courier client) and
// network/timeout failures normalized to NovaPostError, so a hung connection
// fails fast with a clean admin-readable message instead of hanging the action
// or surfacing a raw TypeError.
async function novaFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new NovaPostError(
      0,
      e instanceof Error && e.name === "TimeoutError"
        ? "Nova Post request timed out."
        : "Could not reach Nova Post.",
    );
  }
}

export type NovaPostConfig = {
  apiKey: string;
  sandbox?: boolean;
  countryCode?: string; // default "MD"
  companyTin?: string; // sender company TIN, for the contracts lookup
};

export type NovaPostCodAccount = {
  bankIban?: string;
  accountNumber?: string;
  accountCurrency?: string;
};

export type NovaPostContract = {
  number?: string;
  type?: string; // "Client" | "COD" | …
  serviceCode?: string;
  company?: { tin?: string; name?: string };
  currencyCode?: string;
  cod?: NovaPostCodAccount[];
};

export type DivisionOption = {
  id: number;
  name: string;
  number: string | null;
  address: string | null;
  customerServiceAvailable: boolean;
};

export type SettlementOption = {
  id: number;
  name: string;
  region: string | null;
  postCode: string | null;
};

export type StreetOption = {
  id: number;
  name: string;
};

type CachedToken = { jwt: string; expEpochMs: number };
const tokenCache = new Map<string, CachedToken>();

function baseUrl(cfg: NovaPostConfig): string {
  return cfg.sandbox ? SANDBOX : PROD;
}

/** Decode a JWT's `exp` (seconds) without verifying — only to schedule refresh. */
function jwtExpiryMs(jwt: string): number | null {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function authorize(cfg: NovaPostConfig): Promise<string> {
  const cacheKey = `${cfg.sandbox ? "s" : "p"}:${cfg.apiKey}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expEpochMs - 60_000 > Date.now()) return cached.jwt;

  const res = await novaFetch(
    `${baseUrl(cfg)}clients/authorization?apiKey=${encodeURIComponent(cfg.apiKey)}`,
    { headers: { Accept: "application/json" } },
  );
  const body = (await res.json().catch(() => ({}))) as { jwt?: string; errors?: unknown };
  if (!res.ok || !body.jwt) {
    throw new NovaPostError(res.status, body.errors ?? "authorization failed");
  }
  // Fall back to a 30-minute TTL if the token carries no decodable expiry.
  const exp = jwtExpiryMs(body.jwt) ?? Date.now() + 30 * 60_000;
  tokenCache.set(cacheKey, { jwt: body.jwt, expEpochMs: exp });
  return body.jwt;
}

export class NovaPostError extends Error {
  /** True when the carrier may have processed the request despite the failure
   *  (timeout, transport drop, 5xx, unreadable success body). Set only around
   *  the shipment-create call — callers holding a duplicate guard must NOT
   *  release it on such an error, or a retry could mint a second waybill. */
  public maybeProcessed = false;

  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`Nova Post API error ${status}`);
    this.name = "NovaPostError";
  }
}

function humanizeKey(k: string): string {
  const s = k
    .replace(/[._]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Pull human-readable leaf messages out of an arbitrary error payload. */
function leafMessages(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(leafMessages);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return [o.message.trim()];
    return Object.values(o).flatMap(leafMessages);
  }
  return [];
}

/**
 * Turn a Nova Post error body into a short, admin-readable reason. Handles the
 * API's shapes — a `{ field: [messages] }` map, a list, a `{ message }`, or a
 * bare string — prefixing field names when they add context. Falls back to the
 * HTTP status so the message is never empty.
 */
export function describeNovaPostError(err: NovaPostError): string {
  const d = err.detail;
  const parts: string[] = [];
  if (d && typeof d === "object" && !Array.isArray(d)) {
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
      const msgs = leafMessages(v);
      if (msgs.length === 0) continue;
      const key = humanizeKey(k);
      const bare = /^\d+$/.test(k) || ["general", "message", "errors"].includes(k.toLowerCase());
      parts.push(bare || !key ? msgs.join(", ") : `${key}: ${msgs.join(", ")}`);
    }
  } else {
    parts.push(...leafMessages(d));
  }
  const unique = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  return unique.slice(0, 5).join(" • ") || `HTTP ${err.status}`;
}

// Authenticated GET with one automatic re-auth on 401 (expired/revoked token).
async function apiGet(
  cfg: NovaPostConfig,
  path: string,
  params: Record<string, string | number | string[]>,
): Promise<unknown> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, item));
    else qs.append(k, String(v));
  }
  const run = async (jwt: string) =>
    novaFetch(`${baseUrl(cfg)}${path}?${qs.toString()}`, {
      headers: { Authorization: jwt, Accept: "application/json" },
    });

  let jwt = await authorize(cfg);
  let res = await run(jwt);
  if (res.status === 401) {
    tokenCache.delete(`${cfg.sandbox ? "s" : "p"}:${cfg.apiKey}`);
    jwt = await authorize(cfg);
    res = await run(jwt);
  }
  const body = (await res.json().catch(() => ({}))) as { items?: unknown; errors?: unknown };
  if (!res.ok) throw new NovaPostError(res.status, body.errors ?? body);
  return body.items ?? [];
}

type RawDivision = {
  id: number;
  name?: string;
  shortName?: string;
  number?: string;
  address?: string;
  displayAddress?: string;
  customerServiceAvailable?: boolean;
};

type RawSettlement = {
  id: number;
  name?: string;
  region?: { name?: string } | null;
  postCode1?: string | null;
};

/** Search branches/divisions by free text (what the Division-ID picker calls). */
export async function searchDivisions(
  cfg: NovaPostConfig,
  text: string,
  opts: { settlementIds?: number[]; limit?: number } = {},
): Promise<DivisionOption[]> {
  const params: Record<string, string | number | string[]> = {
    "countryCodes[]": cfg.countryCode ?? "MD",
    textSearch: text,
    limit: opts.limit ?? 15,
    deletionMark: "false",
  };
  if (opts.settlementIds?.length) {
    params["settlementIds[]"] = opts.settlementIds.map(String);
  }
  const items = (await apiGet(cfg, "divisions", params)) as RawDivision[];
  return items.map((d) => ({
    id: d.id,
    name: d.shortName || d.name || `#${d.id}`,
    number: d.number ?? null,
    address: d.displayAddress || d.address || null,
    customerServiceAvailable: Boolean(d.customerServiceAvailable),
  }));
}

/** Search settlements (cities/localities) by free text. */
export async function searchSettlements(
  cfg: NovaPostConfig,
  text: string,
  opts: { limit?: number } = {},
): Promise<SettlementOption[]> {
  const items = (await apiGet(cfg, "settlements", {
    "countryCodes[]": cfg.countryCode ?? "MD",
    textSearch: text,
    limit: opts.limit ?? 15,
    deletionMark: "false",
  })) as RawSettlement[];
  return items.map((s) => ({
    id: s.id,
    name: s.name ?? `#${s.id}`,
    region: s.region?.name ?? null,
    postCode: s.postCode1 ?? null,
  }));
}

type RawStreet = {
  id: number;
  name?: string;
  description?: string;
  streetName?: string;
};

/** Search streets by name, scoped to a settlement (door-delivery address help). */
export async function searchStreets(
  cfg: NovaPostConfig,
  text: string,
  opts: { settlementId?: number; limit?: number } = {},
): Promise<StreetOption[]> {
  const params: Record<string, string | number | string[]> = {
    "countryCodes[]": cfg.countryCode ?? "MD",
    name: text,
    limit: opts.limit ?? 20,
    deletionMark: "false",
  };
  if (opts.settlementId) params.settlementId = opts.settlementId;
  const items = (await apiGet(cfg, "streets", params)) as RawStreet[];
  return items.map((st) => ({
    id: st.id,
    name: st.name || st.streetName || st.description || `#${st.id}`,
  }));
}

/**
 * Fetch the sender's company contracts (Client + COD). Everything client-
 * specific — contract numbers, company TIN, COD bank account — comes from here
 * at shipment time; nothing is stored in code. Keyed by the `companyTin` the
 * admin saved in settings.
 */
export async function fetchContracts(cfg: NovaPostConfig): Promise<NovaPostContract[]> {
  const activeOnDate = new Date().toISOString().replace(/\.\d+Z$/, ".000000Z");
  const params: Record<string, string | number | string[]> = {
    "countryCodes[]": cfg.countryCode ?? "MD",
    deletionMark: "false",
    activeOnDate,
  };
  if (cfg.companyTin) params["companies[]"] = cfg.companyTin;
  return (await apiGet(cfg, "clients/companies/contracts", params)) as NovaPostContract[];
}

// Authenticated POST with one automatic re-auth on 401. Returns the parsed body.
async function apiPost(
  cfg: NovaPostConfig,
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const run = async (jwt: string) =>
    novaFetch(`${baseUrl(cfg)}${path}`, {
      method: "POST",
      headers: {
        Authorization: jwt,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

  let jwt = await authorize(cfg);
  let res = await run(jwt);
  if (res.status === 401) {
    tokenCache.delete(`${cfg.sandbox ? "s" : "p"}:${cfg.apiKey}`);
    jwt = await authorize(cfg);
    res = await run(jwt);
  }
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new NovaPostError(res.status, parsed.errors ?? parsed);
  return parsed;
}

// Authenticated DELETE with one automatic re-auth on 401. Returns the raw
// Response so the caller can branch on the HTTP status (200 / 404 / 422 / …).
async function apiDelete(cfg: NovaPostConfig, path: string): Promise<Response> {
  const run = async (jwt: string) =>
    novaFetch(`${baseUrl(cfg)}${path}`, {
      method: "DELETE",
      headers: { Authorization: jwt, Accept: "application/json" },
    });

  let jwt = await authorize(cfg);
  let res = await run(jwt);
  if (res.status === 401) {
    tokenCache.delete(`${cfg.sandbox ? "s" : "p"}:${cfg.apiKey}`);
    jwt = await authorize(cfg);
    res = await run(jwt);
  }
  return res;
}

/**
 * Cancel (delete) a waybill by its Nova Post shipment id (`DELETE shipments/{id}`).
 * Nova Post only deletes a shipment that hasn't progressed; a picked-up / in-
 * transit one is rejected (4xx) and reported as `refused` so the caller can offer
 * a Lampino-only removal while the real waybill stays live. A 404 (gone) or an
 * already-deleted 422 is `alreadyGone`. Network/timeout/auth problems throw
 * NovaPostError so the operator retries rather than dropping the row blindly.
 */
export async function cancelShipment(
  cfg: NovaPostConfig,
  shipmentId: string,
): Promise<CancelResult> {
  const res = await apiDelete(cfg, `shipments/${encodeURIComponent(shipmentId)}`);
  if (res.ok) return { status: "cancelled" };
  if (res.status === 404) return { status: "alreadyGone" };

  const body = (await res.json().catch(() => ({}))) as { errors?: unknown; message?: unknown };
  const reason = describeNovaPostError(new NovaPostError(res.status, body.errors ?? body));
  // Repeated deletion comes back 422 with the `shipment_was_deleted` error slug —
  // idempotent success. Match the slug exactly (on the raw body, not the
  // humanized reason): a rejection like "shipment can not be deleted" must stay
  // `refused`, or a live waybill would be dropped locally as already-gone.
  if (res.status === 422 && /shipment_was_deleted/i.test(JSON.stringify(body))) {
    return { status: "alreadyGone" };
  }
  // A plain client-side rejection (e.g. the shipment has already progressed):
  // keep the live waybill and let the operator remove the row locally. A 401 is
  // an auth failure and a 5xx is a transport problem — throw so they retry.
  if (res.status >= 400 && res.status < 500 && res.status !== 401) {
    return { status: "refused", reason };
  }
  throw new NovaPostError(res.status, body.errors ?? body);
}

// --- Shipment creation (waybill) --------------------------------------------

export type NovaPostParcel = {
  description: string;
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  insuranceCost: number;
};

export type NovaPostSenderInfo = {
  name: string;
  phone: string;
  email: string;
  companyTin: string;
  countryCode: string;
  divisionId: string;
};

export type NovaPostRecipientInfo = {
  name: string;
  phone: string;
  email: string;
  countryCode: string;
  settlementId: string;
  /** The chosen settlement's name — fills `addressParts.city` for door delivery. */
  settlementName?: string;
  /** Branch/locker pickup: the chosen division id. */
  divisionId?: string | null;
  /** Door delivery: a structured street address (used when no divisionId). */
  address?: {
    street: string;
    building?: string;
    flat?: string;
    postCode?: string;
    block?: string;
  } | null;
};

export type NovaPostShipmentRequest = {
  clientOrder: string;
  note?: string | null;
  payerType: "Sender" | "Recipient";
  /** When set, collect this amount on delivery (COD / "Nova Pay"). */
  cod?: { amount: number } | null;
  sender: NovaPostSenderInfo;
  recipient: NovaPostRecipientInfo;
  parcels: NovaPostParcel[];
};

/** Build the COD ("Nova Pay") service from the account's COD contract. */
function buildCodService(
  amount: number,
  codContract: NovaPostContract,
): Record<string, unknown> {
  const bank = codContract.cod?.[0] ?? {};
  return {
    shipmentParcelRowNumber: null,
    serviceCode: codContract.serviceCode ?? codContract.type ?? "COD",
    amount,
    contractNumber: null,
    payerType: "Recipient",
    additionalParameters: {
      phone: null,
      fullName: null,
      date: null,
      from: null,
      to: null,
      string: null,
      cod: {
        cash: null,
        card: null,
        bankAccount: {
          amount,
          currencyCode: bank.accountCurrency ?? codContract.currencyCode ?? "MDL",
          bankAccountName: bank.accountNumber ?? bank.bankIban ?? null,
          bankAccountId: codContract.company?.tin ?? null,
          description: "",
          commissionPayer: "Sender",
        },
      },
    },
  };
}

/**
 * Map the structured request to the exact `POST shipments` body. The contracts
 * (fetched per shipment) supply the client-specific data: the sender company
 * name, the payer contract number when the sender pays, and the COD bank
 * account when collecting on delivery.
 */
export function buildNovaPostShipmentBody(
  req: NovaPostShipmentRequest,
  contracts: NovaPostContract[] = [],
): Record<string, unknown> {
  const clientContract = contracts.find((c) => c.type === "Client");
  const codContract = contracts.find((c) => c.type === "COD" && (c.cod?.length ?? 0) > 0);
  const senderCompanyName = clientContract?.company?.name ?? null;

  const services =
    req.cod && req.cod.amount > 0 && codContract
      ? [buildCodService(req.cod.amount, codContract)]
      : [];

  // When the sender pays, bill it against the Client contract.
  const senderPayer =
    req.payerType === "Sender"
      ? {
          payerType: "Sender" as const,
          payerContractNumber: clientContract?.number ?? null,
          payerCompanyTin: req.sender.companyTin || null,
          payerCompanyName: senderCompanyName,
          additionalParameters: { paymentForm: "Contract" },
        }
      : {};

  return {
    status: "ReadyToShip",
    clientOrder: req.clientOrder.slice(0, 50),
    note: req.note ? req.note.slice(0, 255) : null,
    payerType: req.payerType,
    payerContractNumber: null,
    payerCompanyTin: null,
    payerCompanyName: null,
    invoice: null,
    services,
    parcels: req.parcels.map((p, i) => ({
      cargoCategory: "parcel",
      number: null,
      rowNumber: i + 1,
      untied: false,
      parcelDescription: p.description,
      insuranceCost: p.insuranceCost,
      width: p.widthMm,
      length: p.lengthMm,
      height: p.heightMm,
      actualWeight: p.weightG,
    })),
    sender: {
      name: req.sender.name,
      phone: req.sender.phone,
      email: req.sender.email || null,
      companyName: senderCompanyName,
      companyTin: req.sender.companyTin || null,
      countryCode: req.sender.countryCode || "MD",
      divisionId: req.sender.divisionId,
    },
    recipient: {
      companyTin: "",
      companyName: "",
      name: req.recipient.name,
      phone: req.recipient.phone,
      email: req.recipient.email || null,
      countryCode: req.recipient.countryCode || "MD",
      settlementId: req.recipient.settlementId,
      divisionId: req.recipient.divisionId ?? null,
      address: null,
      addressParts: req.recipient.address
        ? {
            city: req.recipient.settlementName ?? "",
            region: "",
            street: req.recipient.address.street,
            postCode: req.recipient.address.postCode ?? null,
            building: req.recipient.address.building ?? null,
            flat: req.recipient.address.flat ?? null,
            block: req.recipient.address.block ?? "",
            note: "",
          }
        : null,
    },
    ...senderPayer,
  };
}

export type NovaPostShipmentResult = {
  number: string;
  id: string | null;
  /** The exact body sent — stored on the Shipment for audit. */
  body: Record<string, unknown>;
};

/**
 * Create a waybill. NOTE: this mints a REAL shipment in the Nova Post account —
 * callers must gate it behind an explicit operator action.
 */
export async function createShipment(
  cfg: NovaPostConfig,
  req: NovaPostShipmentRequest,
): Promise<NovaPostShipmentResult> {
  // Contracts carry the sender company name, the payer contract number, and the
  // COD bank account — fetched per shipment, never hardcoded.
  const contracts = await fetchContracts(cfg);

  if (req.cod && req.cod.amount > 0) {
    const codContract = contracts.find((c) => c.type === "COD" && (c.cod?.length ?? 0) > 0);
    if (!codContract) {
      throw new NovaPostError(0, {
        cod: ["No active COD contract with a bank account was found for this Nova Post account."],
      });
    }
  }

  const body = buildNovaPostShipmentBody(req, contracts);
  let res;
  try {
    res = await apiPost(cfg, "shipments", body);
  } catch (e) {
    // Once the POST is in flight the carrier may have processed it even though
    // no (valid) response came back — tag timeouts/transport drops/5xx so the
    // caller keeps its duplicate guard instead of releasing it for a retry.
    // A 4xx is a definite rejection and stays untagged.
    if (e instanceof NovaPostError && (e.status === 0 || e.status >= 500)) {
      e.maybeProcessed = true;
    }
    throw e;
  }
  const number = (res.number ?? res.id) as string | number | undefined;
  if (!number) {
    // The create itself returned OK — the waybill very likely exists even
    // though we couldn't read its number.
    const err = new NovaPostError(200, res.errors ?? res.message ?? "no waybill number returned");
    err.maybeProcessed = true;
    throw err;
  }
  return { number: String(number), id: res.id ? String(res.id) : null, body };
}
