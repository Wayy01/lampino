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
  companyTin?: string; // sender company TIN — the contracts lookup is scoped to it
};

export type NovaPostCodAccount = {
  id?: string;
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

/** Which contracts a shipment bills against, by contract number. A blank
 *  number means "the first active contract of that type". */
export type NovaPostContractSelection = {
  client?: string | null;
  cod?: string | null;
  /** Which payout account of the picked COD contract (its id at Nova Post);
   *  blank means the contract's first. */
  codAccount?: string | null;
};

/** A contract trimmed for the settings picker (no full bank details). A COD
 *  contract yields one option per payout account: the account is what Nova Pay
 *  is actually told to pay out to. */
export type ContractOption = {
  number: string;
  type: "Client" | "COD";
  companyName: string | null;
  /** COD only: the payout account's id — what a pick stores. */
  account: string | null;
  /** COD only: the tail of the payout account, enough to tell accounts apart. */
  accountTail: string | null;
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
    const err = new NovaPostError(res.status, body.errors ?? "authorization failed");
    err.authFailed = true;
    throw err;
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
  /** True when Nova Post refused the API key itself (the authorization step),
   *  as opposed to rejecting what an authorized request asked for. */
  public authFailed = false;

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
 *
 * Without a TIN there is nothing to return: the endpoint is not scoped to the
 * API key, so an unfiltered call pages through every Nova Post client's
 * contracts in the country — and "the first one" would be a stranger's.
 */
export async function fetchContracts(cfg: NovaPostConfig): Promise<NovaPostContract[]> {
  const companyTin = normalizeCompanyTin(cfg.companyTin);
  if (!companyTin) return [];
  const activeOnDate = new Date().toISOString().replace(/\.\d+Z$/, ".000000Z");
  const params: Record<string, string | number | string[]> = {
    "countryCodes[]": cfg.countryCode ?? "MD",
    "companies[]": companyTin,
    deletionMark: "false",
    activeOnDate,
    limit: 100,
  };
  return (await apiGet(cfg, "clients/companies/contracts", params)) as NovaPostContract[];
}

/**
 * A company TIN the way Nova Post matches it: without whitespace (a number
 * typed in groups finds no contracts). Applied wherever the TIN is saved, looked
 * up or sent, so the settings picker and a shipment can't disagree about it.
 */
export function normalizeCompanyTin(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "");
}

const hasCodAccount = (c: NovaPostContract) => (c.cod?.length ?? 0) > 0;

/** What identifies a COD payout account in a saved pick. */
const codAccountKey = (a: NovaPostCodAccount) => a.id ?? a.accountNumber ?? a.bankIban ?? "";

/**
 * Pick the Client (delivery) and COD contracts for a shipment, and the COD
 * contract's payout account. A number chosen in settings must match exactly:
 * when it is no longer among the active contracts the result is `undefined`,
 * never a silent swap to another contract (that would bill a different
 * agreement) — and the same goes for a chosen payout account. With nothing
 * chosen, the first active contract of the type (and its first account) is
 * used. A COD contract without a bank account can't receive Nova Pay, so it
 * never counts.
 */
export function resolveContracts(
  contracts: NovaPostContract[],
  selection: NovaPostContractSelection = {},
): { client?: NovaPostContract; cod?: NovaPostContract; codAccount?: NovaPostCodAccount } {
  const clients = contracts.filter((c) => c.type === "Client");
  const cods = contracts.filter((c) => c.type === "COD" && hasCodAccount(c));
  const cod = selection.cod ? cods.find((c) => c.number === selection.cod) : cods[0];
  return {
    client: selection.client ? clients.find((c) => c.number === selection.client) : clients[0],
    cod,
    codAccount:
      selection.cod && selection.codAccount
        ? cod?.cod?.find((a) => codAccountKey(a) === selection.codAccount)
        : cod?.cod?.[0],
  };
}

/** The company's active Client and COD contracts, for the settings picker. */
export async function listContractOptions(cfg: NovaPostConfig): Promise<ContractOption[]> {
  const contracts = await fetchContracts(cfg);
  const options: ContractOption[] = [];
  for (const c of contracts) {
    if (!c.number) continue;
    const base = { number: c.number, companyName: c.company?.name ?? null };
    if (c.type === "Client") {
      options.push({ ...base, type: "Client", account: null, accountTail: null });
    } else if (c.type === "COD") {
      for (const a of c.cod ?? []) {
        const number = a.accountNumber ?? a.bankIban ?? "";
        options.push({
          ...base,
          type: "COD",
          account: codAccountKey(a),
          accountTail: number ? number.slice(-4) : null,
        });
      }
    }
  }
  return options;
}

/** Why the saved contract settings can't serve a shipment. */
export type NovaPostContractIssue =
  /** The delivery contract picked in settings is no longer active. */
  | "clientContractInactive"
  /** The Nova Pay contract (or its payout account) picked in settings is gone. */
  | "codContractInactive"
  /** Nova Pay was asked for, but there is no company TIN to find contracts by. */
  | "codTinMissing"
  /** The company has no active COD contract with a bank account. */
  | "codContractMissing";

/** A shipment that the saved contract settings can't serve; nothing was sent. */
export class NovaPostContractError extends Error {
  constructor(
    public issue: NovaPostContractIssue,
    /** The picked contract's number, when the issue is about a pick. */
    public contractNumber: string | null = null,
  ) {
    super(`Nova Post contract issue: ${issue}`);
    this.name = "NovaPostContractError";
  }
}

/** The contracts settled for one shipment (see `resolveShipmentContracts`). */
export type NovaPostShipmentContracts = {
  /** The sender company's name, as Nova Post has it. */
  companyName: string | null;
  /** Billed for delivery when the sender pays. Absent, Nova Post bills cash. */
  client?: NovaPostContract;
  /** Set when the shipment collects on delivery: where Nova Pay pays out. */
  cod?: { contract: NovaPostContract; account: NovaPostCodAccount };
};

/**
 * Fetch the sender company's contracts and settle which ones a shipment uses.
 * Nothing is created at Nova Post, so callers run this before reserving
 * anything of their own. Throws `NovaPostContractError` when the shipment needs
 * a contract the settings can't supply — a contract picked in settings that is
 * no longer active is refused rather than swapped for another one, which would
 * bill (or pay out to) an agreement the admin didn't choose. The delivery
 * contract is only billed when the sender pays, so a lapsed pick doesn't stop a
 * recipient-paid shipment.
 */
export async function resolveShipmentContracts(
  cfg: NovaPostConfig,
  req: NovaPostShipmentRequest,
): Promise<NovaPostShipmentContracts> {
  const contracts = await fetchContracts(cfg);
  const picked = req.contracts ?? {};
  const resolved = resolveContracts(contracts, picked);
  const senderPays = req.payerType === "Sender";
  const collects = Boolean(req.cod && req.cod.amount > 0);

  if (senderPays && picked.client && !resolved.client) {
    throw new NovaPostContractError("clientContractInactive", picked.client);
  }
  const cod =
    resolved.cod && resolved.codAccount
      ? { contract: resolved.cod, account: resolved.codAccount }
      : undefined;
  if (collects && !cod) {
    if (!normalizeCompanyTin(cfg.companyTin)) throw new NovaPostContractError("codTinMissing");
    throw picked.cod
      ? new NovaPostContractError("codContractInactive", picked.cod)
      : new NovaPostContractError("codContractMissing");
  }

  return {
    // Every contract here belongs to the one company the TIN names, so its
    // name survives a lapsed delivery-contract pick.
    companyName:
      resolved.client?.company?.name ??
      contracts.find((c) => c.company?.name)?.company?.name ??
      null,
    client: senderPays ? resolved.client : undefined,
    cod: collects ? cod : undefined,
  };
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
  /** Branch drop-off: the division the parcels are handed in at. */
  divisionId?: string | null;
  /** Courier pickup: the address the parcels are collected from. When set it
   *  is used instead of `divisionId`. */
  address?: {
    settlementId: string;
    /** The settlement's name — fills `addressParts.city`. */
    settlementName: string;
    street: string;
    building: string;
    flat?: string;
    postCode: string;
    note?: string;
  } | null;
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
  /** The contracts picked in settings; omitted = first active of each type. */
  contracts?: NovaPostContractSelection;
  sender: NovaPostSenderInfo;
  recipient: NovaPostRecipientInfo;
  parcels: NovaPostParcel[];
};

/**
 * Build the COD ("Nova Pay") service: the payout goes to `bank`, one of the COD
 * contract's accounts. The service's own `contractNumber` stays null — it names
 * the contract of whoever pays for the service (the recipient), not the COD
 * contract; Nova Post finds that by the company TIN and the account.
 */
function buildCodService(
  amount: number,
  codContract: NovaPostContract,
  bank: NovaPostCodAccount,
): Record<string, unknown> {
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
 * (settled per shipment by `resolveShipmentContracts`) supply the client-
 * specific data: the sender company name, the payer contract number when the
 * sender pays, and the COD bank account when collecting on delivery.
 */
export function buildNovaPostShipmentBody(
  req: NovaPostShipmentRequest,
  contracts: NovaPostShipmentContracts = { companyName: null },
): Record<string, unknown> {
  const senderCompanyName = contracts.companyName;

  // Where the parcels leave from: collected by a courier at the sender's
  // address, or handed in at the sender's branch.
  const pickup = req.sender.address;
  const senderOrigin = pickup
    ? {
        settlementId: pickup.settlementId,
        divisionId: null,
        address: null,
        addressParts: {
          city: pickup.settlementName,
          region: "",
          street: pickup.street,
          postCode: pickup.postCode,
          building: pickup.building,
          flat: pickup.flat ?? null,
          block: "",
          note: pickup.note ?? "",
        },
      }
    : { divisionId: req.sender.divisionId };

  const services =
    req.cod && req.cod.amount > 0 && contracts.cod
      ? [buildCodService(req.cod.amount, contracts.cod.contract, contracts.cod.account)]
      : [];

  // When the sender pays, bill it against the Client contract.
  const senderPayer =
    req.payerType === "Sender"
      ? {
          payerType: "Sender" as const,
          payerContractNumber: contracts.client?.number ?? null,
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
      ...senderOrigin,
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
 * callers must gate it behind an explicit operator action. `contracts` comes
 * from `resolveShipmentContracts`: they carry the sender company name, the payer
 * contract number and the COD bank account — fetched per shipment, never
 * hardcoded.
 */
export async function createShipment(
  cfg: NovaPostConfig,
  req: NovaPostShipmentRequest,
  contracts: NovaPostShipmentContracts,
): Promise<NovaPostShipmentResult> {
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
