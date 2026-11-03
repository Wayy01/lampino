// Nova Post API client (server-only). Thin wrapper over the v1.0 REST API used
// for the admin shipment flow: authenticate, then search settlements/divisions/
// streets. Callers pass the (decrypted) API key and sandbox flag — this module
// never reads the key store itself, so secret handling stays at the edge.
//
// Auth is a two-step JWT: GET clients/authorization?apiKey=<key> returns a JWT
// that is sent raw in the `Authorization` header (no "Bearer " prefix). Tokens
// are cached per-key in memory and refreshed on expiry or a 401.

const PROD = "https://api.novapost.com/v.1.0/";
const SANDBOX = "https://api-stage.novapost.pl/v.1.0/";

export type NovaPostConfig = {
  apiKey: string;
  sandbox?: boolean;
  countryCode?: string; // default "MD"
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

  const res = await fetch(
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
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(`Nova Post API error ${status}`);
    this.name = "NovaPostError";
  }
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
    fetch(`${baseUrl(cfg)}${path}?${qs.toString()}`, {
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
