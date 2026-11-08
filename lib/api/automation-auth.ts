// Bearer-token guard for the Ligatto order-automation endpoints. Each Ligatto
// "agent" (Integrations → Ligatto) is a named bearer credential; the token is
// stored encrypted (lib/admin/crypto). A request is matched against the enabled
// agents, and the matched agent's name becomes the order's origin. There is no
// IP rate-limit — this is a trusted server-to-server caller and the token is the
// trust boundary. Routes using this must run on the Node runtime
// (`export const runtime = "nodejs"`) for node:crypto.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/admin/crypto";

export type AutomationAgent = { id: number; name: string };

export type AutomationAuth =
  | { response: NextResponse }
  | { agent: AutomationAgent };

/**
 * Resolve the calling agent from the `Authorization: Bearer <token>` header.
 * Returns `{ agent }` on a match, or `{ response }` to send back — `403` when no
 * agent is enabled (integration effectively off), `401` on a bad/missing token.
 */
export async function requireAutomationToken(request: Request): Promise<AutomationAuth> {
  const agents = await prisma.ligattoAgent.findMany({
    where: { enabled: true },
    select: { id: true, name: true, token: true },
  });
  if (agents.length === 0) {
    return { response: NextResponse.json({ ok: false, error: "integration_disabled" }, { status: 403 }) };
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const provided = match?.[1]?.trim() ?? "";
  if (provided) {
    for (const agent of agents) {
      const expected = decryptSecret(agent.token);
      if (expected && safeEqual(provided, expected)) {
        return { agent: { id: agent.id, name: agent.name } };
      }
    }
  }
  return { response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
}

/** Constant-time string compare; `timingSafeEqual` throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
