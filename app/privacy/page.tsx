import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";

export const metadata: Metadata = {
  title: "Privacy — Atelier",
  description:
    "How Atelier collects, uses and protects your data when you request a premium rental.",
};

export default function PrivacyPage() {
  return <LegalContent section="privacy" />;
}
