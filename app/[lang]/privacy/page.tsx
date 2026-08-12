import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";
import { getContactSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Confidențialitate — Lampino",
  description:
    "Cum colectează, folosește și protejează Lampino datele tale când plasezi o comandă.",
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const contact = await getContactSettings();
  return <LegalContent section="privacy" email={contact?.email ?? null} />;
}
