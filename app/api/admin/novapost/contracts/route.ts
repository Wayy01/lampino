import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin/session";
import { decryptSecret } from "@/lib/admin/crypto";
import { listContractOptions, normalizeCompanyTin, NovaPostError } from "@/lib/courier/novapost";

export const runtime = "nodejs";

// Admin-only contract list for the Nova Post integration form's pickers. Like
// the search proxy it decrypts the saved key server-side; the browser only gets
// trimmed options (number, company, the payout account's id and tail).
// Contracts are looked up by company TIN: `?tin=` is what the form currently
// holds (so the list follows the field before it is saved), else the saved one
// — normalized the same way a shipment does, so the two can't disagree.
// Returns `{ contracts }` or an `{ error }` the client can message on: `bad_key`
// (Nova Post refused the key), `bad_tin` (it refused the TIN) or
// `contracts_failed` (anything else — an outage, a timeout).
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const settings = await prisma.shippingSettings.findFirst({ where: { isActive: true } });
  const apiKey = decryptSecret(settings?.novapostApiKey);
  if (!apiKey) {
    return NextResponse.json({ error: "no_key" }, { status: 400 });
  }

  const companyTin = normalizeCompanyTin(
    req.nextUrl.searchParams.get("tin") ?? settings!.novapostSenderCompanyTin,
  );
  if (!companyTin) return NextResponse.json({ contracts: [] });

  try {
    const contracts = await listContractOptions({
      apiKey,
      sandbox: settings!.novapostSandbox,
      countryCode: settings!.novapostSenderCountryCode || "MD",
      companyTin,
    });
    return NextResponse.json({ contracts });
  } catch (e) {
    if (e instanceof NovaPostError && (e.authFailed || e.status === 401)) {
      return NextResponse.json({ error: "bad_key" }, { status: 400 });
    }
    // The key was accepted, so a validation error is about the one thing this
    // request varies: the TIN.
    if (e instanceof NovaPostError && e.status === 422) {
      return NextResponse.json({ error: "bad_tin" }, { status: 400 });
    }
    return NextResponse.json({ error: "contracts_failed" }, { status: 502 });
  }
}
