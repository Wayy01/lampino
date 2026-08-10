import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";

export const metadata: Metadata = {
  title: "Confidențialitate — Lampino",
  description:
    "Cum colectează, folosește și protejează Lampino datele tale când plasezi o comandă.",
};

export default function PrivacyPage() {
  return <LegalContent section="privacy" />;
}
