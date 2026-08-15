// Turns anything an admin server action can throw into a translated sentence
// the admin can act on. Validation errors are still modelled as return values
// (see each action's `parse*`); this is the layer underneath them — the
// database, the filesystem and the session — where a throw used to escape the
// action, reject the transition, and leave the dashboard showing nothing.
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma";
import { getAdminDict, type AdminDict, type AdminLang } from "@/lib/admin/i18n";

/** What every admin action resolves to once it can report a failure. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Refusals with a known cause, keyed to the `errors` block of the dictionary. */
export type RefusalKey =
  | "reorderStale"
  | "sourceMissing"
  | "cannotDeleteSelf"
  | "cannotDeleteLastAdmin";

/**
 * A deliberate refusal, thrown from inside an action body so it travels the
 * same path as a database failure and comes back translated. These are the
 * cases that used to `return` early and leave the screen unchanged.
 */
export class ActionRefusal extends Error {
  readonly key: RefusalKey;

  constructor(key: RefusalKey) {
    super(key);
    this.name = "ActionRefusal";
    this.key = key;
  }
}

/**
 * Map a thrown value to an admin-facing message.
 *
 * `unstable_rethrow` runs first and unconditionally: `redirect()` and
 * `notFound()` interrupt control flow by throwing, so without it every action
 * that redirects on success (`createProduct`, `duplicateRental`, the deletes)
 * would have its navigation swallowed here and report a bogus failure instead.
 */
export function describeError(error: unknown, lang: AdminLang): string {
  unstable_rethrow(error);

  const t = getAdminDict(lang).errors;

  if (error instanceof ActionRefusal) return t[error.key];

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return knownRequestMessage(error, t);
  }
  // The client could not reach or authenticate against Postgres at all.
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return t.databaseUnreachable;
  }
  // A malformed query — our bug, not the admin's. Say so plainly rather than
  // blaming their input.
  if (error instanceof Prisma.PrismaClientValidationError) {
    return t.invalidQuery;
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return t.databaseUnreachable;
  }
  return t.unexpected;
}

function knownRequestMessage(
  error: Prisma.PrismaClientKnownRequestError,
  t: AdminDict["errors"],
): string {
  switch (error.code) {
    case "P2002":
      // The clashing column is the useful half of this message — "slug already
      // exists" beats "duplicate value".
      return withField(t.duplicate, fieldsOf(error));
    case "P2003":
      return t.stillReferenced;
    case "P2011":
      return withField(t.missingRequired, fieldsOf(error));
    case "P2000":
      return withField(t.valueTooLong, fieldsOf(error));
    case "P2025":
      // Prisma's own `meta.cause` explains which nested write missed.
      return t.recordMissing;
    case "P2034":
      return t.writeConflict;
    case "P2024":
      return t.databaseBusy;
    case "P1001":
    case "P1002":
    case "P1017":
      return t.databaseUnreachable;
    case "P1008":
      return t.databaseTimeout;
    default:
      return t.unexpected;
  }
}

/** Column names Prisma attached to the failure, when it named any. */
function fieldsOf(error: Prisma.PrismaClientKnownRequestError): string | null {
  const meta = error.meta as
    | { target?: unknown; field_name?: unknown; column_name?: unknown }
    | undefined;
  const raw = meta?.target ?? meta?.field_name ?? meta?.column_name;
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const names = list.filter((v): v is string => typeof v === "string");
  return names.length > 0 ? names.join(", ") : null;
}

function withField(message: string, fields: string | null): string {
  return fields ? `${message} (${fields})` : message;
}

/**
 * Run an action body and convert a throw into `{ ok: false, error }`.
 *
 * Actions that redirect on success never return through here — the redirect
 * throws and `describeError` rethrows it — so the `{ ok: true }` result is
 * only ever seen by actions that stay on the page.
 */
export async function runAction(
  lang: AdminLang,
  body: () => Promise<void>,
): Promise<ActionResult> {
  try {
    await body();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error, lang) };
  }
}

/**
 * Same, for actions that return a `{ ok?, error? }` form state: a caught throw
 * becomes the same `{ error }` shape the validation branches already return,
 * so `ActionNotice` renders both without knowing the difference.
 */
export async function runFormAction<T extends { ok?: boolean; error?: string }>(
  lang: AdminLang,
  body: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await body();
  } catch (error) {
    return { error: describeError(error, lang) };
  }
}
