import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin/session";
import { decryptSecret } from "@/lib/admin/crypto";
import { searchCities, FanCourierError } from "@/lib/courier/fancourier";

export const runtime = "nodejs";

// Admin-only city autocomplete for the Fan Courier shipment form. Decrypts the
// saved key server-side and queries the API — the key never reaches the
// browser. Returns `{ options }` ({ name, province }) or an `{ error }` the
// client can message on.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ options: [] });
  const province = (req.nextUrl.searchParams.get("province") ?? "").trim();

  const settings = await prisma.shippingSettings.findFirst({ orderBy: { id: "asc" } });
  const apiKey = decryptSecret(settings?.fancourierApiKey);
  if (!apiKey) {
    return NextResponse.json({ error: "no_key" }, { status: 400 });
  }

  try {
    const options = await searchCities({ apiKey }, q, province ? { province } : {});
    return NextResponse.json({ options });
  } catch (e) {
    if (e instanceof FanCourierError && e.code === "BAD_LOGIN") {
      return NextResponse.json({ error: "bad_key" }, { status: 400 });
    }
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
