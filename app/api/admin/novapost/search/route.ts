import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin/session";
import { decryptSecret } from "@/lib/admin/crypto";
import {
  searchDivisions,
  searchSettlements,
  searchStreets,
  NovaPostError,
} from "@/lib/courier/novapost";

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
  const typeRaw = req.nextUrl.searchParams.get("type");
  const type =
    typeRaw === "settlements" ? "settlements" : typeRaw === "streets" ? "streets" : "divisions";
  if (q.length < 2) return NextResponse.json({ options: [] });

  // Optional: scope a division search to a chosen settlement (the branch picker
  // filters to the recipient's city once it's selected).
  const settlementRaw = req.nextUrl.searchParams.get("settlementId") ?? "";
  const settlementId = /^\d+$/.test(settlementRaw) ? Number(settlementRaw) : null;

  const settings = await prisma.shippingSettings.findFirst({ where: { isActive: true } });
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
        : type === "streets"
          ? await searchStreets(cfg, q, settlementId ? { settlementId } : {})
          : await searchDivisions(cfg, q, settlementId ? { settlementIds: [settlementId] } : {});
    return NextResponse.json({ options });
  } catch (e) {
    // Surface an auth failure distinctly so the UI can say "check the key".
    if (e instanceof NovaPostError && (e.status === 401 || e.status === 422)) {
      return NextResponse.json({ error: "bad_key" }, { status: 400 });
    }
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
