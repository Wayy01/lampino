import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";
import { getContactSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Termeni — Lampino",
  description:
    "Termenii și condițiile pentru comenzile plasate în magazinul de iluminat Lampino.",
};

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const contact = await getContactSettings();
  return <LegalContent section="terms" email={contact?.email ?? null} />;
}
