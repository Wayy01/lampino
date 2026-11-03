import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin/session";
import { decryptSecret } from "@/lib/admin/crypto";
import { searchDivisions, searchSettlements, NovaPostError } from "@/lib/courier/novapost";

export const runtime = "nodejs";

// Admin-only autocomplete proxy for the integration forms. Decrypts the saved
// Nova Post key server-side and queries the API — the key never reaches the
// browser. Returns `{ options }` or an `{ error }` the client can message on.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const type = req.nextUrl.searchParams.get("type") === "settlements" ? "settlements" : "divisions";
  if (q.length < 2) return NextResponse.json({ options: [] });

  const settings = await prisma.shippingSettings.findFirst({ orderBy: { id: "asc" } });
  const apiKey = decryptSecret(settings?.novapostApiKey);
  if (!apiKey) {
    return NextResponse.json({ error: "no_key" }, { status: 400 });
  }

  const cfg = {
    apiKey,
    sandbox: settings!.novapostSandbox,
    countryCode: settings!.novapostSenderCountryCode || "MD",
  };

  try {
    const options =
      type === "settlements"
        ? await searchSettlements(cfg, q)
        : await searchDivisions(cfg, q);
    return NextResponse.json({ options });
  } catch (e) {
    // Surface an auth failure distinctly so the UI can say "check the key".
    if (e instanceof NovaPostError && (e.status === 401 || e.status === 422)) {
      return NextResponse.json({ error: "bad_key" }, { status: 400 });
    }
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
