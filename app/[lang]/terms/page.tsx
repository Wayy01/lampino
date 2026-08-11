import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";

export const metadata: Metadata = {
  title: "Termeni — Lampino",
  description:
    "Termenii și condițiile pentru comenzile plasate în magazinul de iluminat Lampino.",
};

export default function TermsPage() {
  return <LegalContent section="terms" />;
}
